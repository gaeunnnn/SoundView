**음성 분류 모델 조사**
pyannote + ATST-F strong + BEATs strong 시도 해봐야함


**감정 분류 모델 파인튜닝**
SAMPLE_RATE = 16000
MAX_DURATION = 10 
BATCH_SIZE = 8
GRADIENT_ACCUMULATION_STEPS = 4
EPOCHS = 4        
LR = 3e-5   

Epoch	Training Loss	Validation  Loss Accuracy	F1
1	    0.842025	    0.731109	0.757084	    0.757155
2	    0.670189	    0.656939	0.766934	    0.770456
3	    0.600816	    0.654436	0.774814	    0.776989