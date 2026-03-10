import os
os.environ["CUDA_VISIBLE_DEVICES"] = "3"

import pandas as pd
import numpy as np
import torch
from torch import nn
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from sklearn.utils.class_weight import compute_class_weight
from datasets import Dataset
import mlflow  # MLflow 추가
from transformers import (
    TrainingArguments,
    Trainer,
    Wav2Vec2FeatureExtractor,
    AutoTokenizer,
    AutoModel
)
import librosa
import soundfile as sf
from sklearn.metrics import accuracy_score, f1_score

# =========================
# 1. MLflow 실험 설정
# =========================
EXPERIMENT_NAME = "SER_Optimized_Multimodal"
mlflow.set_experiment(EXPERIMENT_NAME)

# =========================
# 2. 기본 설정 (OOM 방지 반영)
# =========================
DATA_PATH = "./wav_data"
CSV_FILE = "./total_master_data.csv"
OUTPUT_DIR = "./results_optimized"

SAMPLE_RATE = 16000
MAX_DURATION = 10 
# 실제 배치는 16으로 하되, 2번 쌓아서(accumulation) 32의 효과를 냄
BATCH_SIZE = 16   
GRADIENT_ACCUMULATION_STEPS = 2 
EPOCHS = 8        
LR = 3e-5         

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# =========================
# 3. 데이터 로드 및 정제
# =========================
df = pd.read_csv(CSV_FILE, encoding="cp949")
emotion_cols = ["1번 감정", "2번 감정", "3번 감정", "4번 감정", "5번 감정"]
df["label"] = df[emotion_cols].mode(axis=1)[0].str.lower()

le = LabelEncoder()
df["label_id"] = le.fit_transform(df["label"])
n_labels = len(le.classes_)

train_df, test_df = train_test_split(df, test_size=0.15, stratify=df["label_id"], random_state=42)

train_dataset = Dataset.from_pandas(train_df[["wav_id", "발화문", "label_id"]])
test_dataset = Dataset.from_pandas(test_df[["wav_id", "발화문", "label_id"]])

# =========================
# 4. 모델 도구 및 전처리
# =========================
audio_extractor = Wav2Vec2FeatureExtractor.from_pretrained("microsoft/wavlm-base")
tokenizer = AutoTokenizer.from_pretrained("klue/bert-base")

def preprocess(batch):
    audio_path = os.path.join(DATA_PATH, batch["wav_id"] + ".wav")
    max_len = SAMPLE_RATE * MAX_DURATION
    try:
        audio, sr = sf.read(audio_path)
        if sr != SAMPLE_RATE: audio = librosa.resample(audio, orig_sr=sr, target_sr=SAMPLE_RATE)
        if len(audio.shape) > 1: audio = audio.mean(axis=1)
        if np.max(np.abs(audio)) > 0: audio = audio / np.max(np.abs(audio))
        if len(audio) > max_len: audio = audio[:max_len]
    except:
        audio = np.zeros(max_len)

    audio_inputs = audio_extractor(audio, sampling_rate=SAMPLE_RATE, padding="max_length", max_length=max_len, return_attention_mask=True)
    text_inputs = tokenizer(batch["발화문"], truncation=True, padding="max_length", max_length=48)

    batch["input_values"] = audio_inputs["input_values"][0]
    batch["audio_mask"] = audio_inputs["attention_mask"][0]
    batch["input_ids"] = text_inputs["input_ids"]
    batch["text_mask"] = text_inputs["attention_mask"]
    batch["labels"] = batch["label_id"]
    return batch

train_dataset = train_dataset.map(preprocess, num_proc=8)
test_dataset = test_dataset.map(preprocess, num_proc=8)
train_dataset.set_format(type="torch", columns=["input_values", "audio_mask", "input_ids", "text_mask", "labels"])
test_dataset.set_format(type="torch", columns=["input_values", "audio_mask", "input_ids", "text_mask", "labels"])

# =========================
# 5. 모델 정의 (BatchNorm 및 최적화 구조)
# =========================
class OptimizedCrossAttentionModel(nn.Module):
    def __init__(self, n_labels):
        super().__init__()
        self.audio_model = AutoModel.from_pretrained("microsoft/wavlm-base")
        self.text_model = AutoModel.from_pretrained("klue/bert-base")
        self.audio_model.gradient_checkpointing_enable()
        self.text_model.gradient_checkpointing_enable()

        audio_hidden = 768
        text_hidden = 768
        self.text_proj = nn.Linear(text_hidden, audio_hidden)
        self.cross_attn = nn.MultiheadAttention(embed_dim=audio_hidden, num_heads=12, batch_first=True, dropout=0.1)
        
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
        audio_feat = self.audio_model(input_values, attention_mask=audio_mask).last_hidden_state
        text_feat = self.text_model(input_ids, attention_mask=text_mask).last_hidden_state
        text_feat_proj = self.text_proj(text_feat)
        
        attn_output, _ = self.cross_attn(query=audio_feat, key=text_feat_proj, value=text_feat_proj, key_padding_mask=(text_mask == 0))
        audio_vec = attn_output.mean(dim=1)
        text_vec = text_feat[:, 0, :]
        
        logits = self.classifier(torch.cat([audio_vec, text_vec], dim=1))

        loss = None
        if labels is not None:
            weights = compute_class_weight("balanced", classes=np.unique(df["label_id"]), y=df["label_id"])
            loss_fn = nn.CrossEntropyLoss(weight=torch.tensor(weights, dtype=torch.float).to(device))
            loss = loss_fn(logits, labels)
        return {"loss": loss, "logits": logits}

model = OptimizedCrossAttentionModel(n_labels).to(device)

# =========================
# 6. MLflow 통합용 TrainingArguments
# =========================
training_args = TrainingArguments(
    output_dir=OUTPUT_DIR,
    eval_strategy="epoch",
    save_strategy="epoch",
    learning_rate=LR,
    
    # MLflow 설정
    report_to="mlflow",          # MLflow로 기록 전송
    logging_steps=50,            # 50스텝마다 로그 기록
    
    # 메모리 및 최적화 설정
    per_device_train_batch_size=BATCH_SIZE,
    gradient_accumulation_steps=GRADIENT_ACCUMULATION_STEPS,
    per_device_eval_batch_size=BATCH_SIZE,
    num_train_epochs=EPOCHS,
    lr_scheduler_type="cosine",
    warmup_ratio=0.15,
    fp16=True,
    load_best_model_at_end=True,
    metric_for_best_model="f1",
    save_total_limit=2
)

def compute_metrics(pred):
    logits, labels = pred.predictions, pred.label_ids
    preds = np.argmax(logits, axis=-1)
    return {"accuracy": accuracy_score(labels, preds), "f1": f1_score(labels, preds, average="weighted")}

trainer = Trainer(
    model=model,
    args=training_args,
    train_dataset=train_dataset,
    eval_dataset=test_dataset,
    compute_metrics=compute_metrics
)

# =========================
# 7. 실행 (MLflow Run 관리)
# =========================
with mlflow.start_run(run_name="SER_Optimized_V1"):
    # 하이퍼파라미터 수동 기록 (선택 사항)
    mlflow.log_param("learning_rate", LR)
    mlflow.log_param("epochs", EPOCHS)
    
    print("🚀 MLflow와 함께 학습 시작...")
    trainer.train()

    print("\n✅ 최종 검증 결과:")
    final_metrics = trainer.evaluate()
    print(final_metrics)