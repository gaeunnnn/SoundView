import torch
from torch import nn
from transformers import AutoModel

class OptimizedCrossAttentionModel(nn.Module):
    """
    HuggingFace bambi1234/korean-emotion-v1 체크포인트와 정확히 일치하는 V6 구조입니다.
    WavLM(음성)과 KLUE-BERT(텍스트) 멀티모달로 감정을 7개로 분류합니다.

    이전 코드와의 핵심 차이점:
      - audio_norm, text_norm LayerNorm 추가 (체크포인트에 있는 키)
      - audio_max 최대 풀링 추가 → 분류기 입력 2304차원 (768 Mean + 768 Max + 768 CLS)
      - classifier[1]: BatchNorm1d → LayerNorm(512) 으로 변경
    """
    def __init__(self, n_labels: int = 7):
        super().__init__()
        # 1. 사전 학습된 모델 로드 (WavLM, BERT)
        self.audio_model = AutoModel.from_pretrained("microsoft/wavlm-base")
        self.text_model = AutoModel.from_pretrained("klue/bert-base")

        audio_hidden = 768
        text_hidden = 768

        # 2. V6: 각 도메인 특징 정규화를 위한 LayerNorm
        self.audio_norm = nn.LayerNorm(audio_hidden)
        self.text_norm = nn.LayerNorm(text_hidden)

        # 3. 텍스트 특징을 오디오 공간으로 투영 (Projection)
        self.text_proj = nn.Linear(text_hidden, audio_hidden)

        # 4. 크로스 어텐션 레이어 (12개 헤드)
        self.cross_attn = nn.MultiheadAttention(
            embed_dim=audio_hidden, num_heads=12, batch_first=True, dropout=0.1
        )

        # 5. V6: 최종 분류기
        #    입력 = Audio Mean(768) + Audio Max(768) + Text [CLS](768) = 2304
        self.classifier = nn.Sequential(
            nn.Linear((audio_hidden * 2) + text_hidden, 512),  # 2304 → 512
            nn.LayerNorm(512),
            nn.ReLU(),
            nn.Dropout(0.4),
            nn.Linear(512, 256),
            nn.ReLU(),
            nn.Linear(256, n_labels)
        )

    def forward(self, input_values, audio_mask, input_ids, text_mask, labels=None):
        # 음성 특징 추출 및 LayerNorm 정규화
        audio_feat = self.audio_model(input_values, attention_mask=audio_mask).last_hidden_state
        audio_feat = self.audio_norm(audio_feat)

        # 텍스트 특징 추출 및 LayerNorm 정규화
        text_feat = self.text_model(input_ids, attention_mask=text_mask).last_hidden_state
        text_feat = self.text_norm(text_feat)

        # 텍스트 → 오디오 공간 투영 후 Cross Attention
        text_feat_proj = self.text_proj(text_feat)
        attn_output, _ = self.cross_attn(
            query=audio_feat,
            key=text_feat_proj,
            value=text_feat_proj,
            key_padding_mask=(text_mask == 0)
        )

        # V6: Mean + Max Pooling 결합으로 시퀀스 정보 집약
        audio_mean = attn_output.mean(dim=1)     # 768
        audio_max, _ = attn_output.max(dim=1)    # 768
        audio_vec = torch.cat([audio_mean, audio_max], dim=1)  # 1536

        # 텍스트 [CLS] 토큰 (768)
        text_vec = text_feat[:, 0, :]

        # 최종 분류: 2304 → 7개 감정
        logits = self.classifier(torch.cat([audio_vec, text_vec], dim=1))
        return {"logits": logits}
