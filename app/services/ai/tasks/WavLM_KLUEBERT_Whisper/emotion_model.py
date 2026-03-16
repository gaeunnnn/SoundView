import torch
from torch import nn
from transformers import AutoModel

class OptimizedCrossAttentionModel(nn.Module):
    """
    사용자가 제공한 멀티모달(음성+텍스트) 감정 분류 모델의 뼈대(인스턴스) 구조입니다.
    WavLM(음성)과 KLUE-BERT(텍스트)를 결합하여 감정을 7개로 분류합니다.
    """
    def __init__(self, n_labels: int = 7):
        super().__init__()
        # 음성 특징을 뽑아낼 마이크로소프트의 WavLM 모델
        self.audio_model = AutoModel.from_pretrained("microsoft/wavlm-base")
        # 텍스트 특징을 뽑아낼 한국어 특화 KLUE-BERT 모델
        self.text_model = AutoModel.from_pretrained("klue/bert-base")
        
        audio_hidden = 768
        text_hidden = 768
        
        # 텍스트와 음성의 차원을 맞춰주기 위한 선형 변환 레이어
        self.text_proj = nn.Linear(text_hidden, audio_hidden)
        # 텍스트와 음성을 융합하기 위한 cross attention 레이어
        self.cross_attn = nn.MultiheadAttention(embed_dim=audio_hidden, num_heads=12, batch_first=True, dropout=0.1)
        
        # 융합된 데이터를 바탕으로 최종 감정을 분류하는 판별기(Classifier)
        self.classifier = nn.Sequential(
            nn.Linear(audio_hidden + text_hidden, 512),
            nn.BatchNorm1d(512),
            nn.ReLU(),
            nn.Dropout(0.4),
            nn.Linear(512, 256),
            nn.ReLU(),
            nn.Linear(256, n_labels)
        )

    def forward(self, input_values, audio_mask, input_ids, text_mask, labels=None):
        """
        실제 데이터가 들어와서 계산되는 과정
        """
        # 음성 특징 추출
        audio_feat = self.audio_model(input_values, attention_mask=audio_mask).last_hidden_state
        # 텍스트 특징 추출
        text_feat = self.text_model(input_ids, attention_mask=text_mask).last_hidden_state
        # 텍스트 특징 차원 가공
        text_feat_proj = self.text_proj(text_feat)
        
        # Cross Attention 연산 (오디오 기준, 텍스트 단서 융합)
        attn_output, _ = self.cross_attn(
            query=audio_feat, 
            key=text_feat_proj, 
            value=text_feat_proj, 
            key_padding_mask=(text_mask == 0)
        )
        
        # 오디오 정보들의 평균(Mean) 추출
        audio_vec = attn_output.mean(dim=1)
        # 텍스트 정보 중 맨 앞의 [CLS] 토큰 추출
        text_vec = text_feat[:, 0, :]

        # 판별기로 분류
        logits = self.classifier(torch.cat([audio_vec, text_vec], dim=1))

        return {"logits": logits}
