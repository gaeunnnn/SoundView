# DRV2605L 내장 이펙트 라이브러리 (ID 1–123)

> Immersion TouchSense® 2200 ROM Library  
> Library 1~5, 7 = ERM (Open-Loop) / Library 6 = LRA (Closed-Loop)  
> Waveform Sequencer 레지스터 (0x04~0x0B)에 ID를 기록하여 사용

> ⚠️ **주의**: ID 1~12 정도는 TI 데이터시트/Adafruit 문서 등에서 확인된 공식 이름입니다.  
> ID 13 이후의 한국어/영어 이름은 실제 진동 특성을 기반으로 **편의상 분류한 것**이며,  
> Immersion의 공식 이펙트 이름과 다를 수 있습니다. 정확한 이름은 TI SLOA189 참조.  
> **실제 사용 시 ID별 진동을 직접 테스트한 후 선택하는 것을 권장합니다.**

---

## 클릭 / 탭 (ID 1–9)

| ID | 영어 | 한국어 |
|---|---|---|
| 1 | Strong Click 100% | 매우 강한 클릭 |
| 2 | Strong Click 60% | 강한 클릭 |
| 3 | Strong Click 30% | 약한 클릭 |
| 4 | Sharp Click 100% | 매우 날카로운 클릭 |
| 5 | Sharp Click 60% | 날카로운 클릭 |
| 6 | Sharp Click 30% | 약한 날카로운 클릭 |
| 7 | Soft Bump 100% | 부드러운 탭 |
| 8 | Soft Bump 60% | 중간 탭 |
| 9 | Soft Bump 30% | 약한 탭 |

## 더블 클릭 (ID 10–12)

| ID | 영어 | 한국어 |
|---|---|---|
| 10 | Double Click 100% | 강한 더블 클릭 |
| 11 | Double Click 60% | 중간 더블 클릭 |
| 12 | Double Click 30% | 약한 더블 클릭 |

## 틱 / 탁 (ID 13–15)

| ID | 영어 | 한국어 |
|---|---|---|
| 13 | Sharp Tick 100% | 강한 틱 |
| 14 | Sharp Tick 80% | 중간 틱 |
| 15 | Sharp Tick 60% | 약한 틱 |

## 짧은 알림 (ID 16–19)

| ID | 영어 | 한국어 |
|---|---|---|
| 16 | Short Double Click | 짧은 더블 알림 |
| 17 | Long Double Click | 긴 더블 알림 |
| 18 | Short Sharp Tick | 짧은 날카로운 진동 |
| 19 | Long Sharp Tick | 긴 날카로운 진동 |

## 버즈 (ID 20–23)

| ID | 영어 | 한국어 |
|---|---|---|
| 20 | Buzz 100% | 강한 버즈 |
| 21 | Buzz 80% | 중간 버즈 |
| 22 | Buzz 60% | 약한 버즈 |
| 23 | Buzz 40% | 매우 약한 버즈 |

## 트랜지션 (ID 24–29)

| ID | 영어 | 한국어 |
|---|---|---|
| 24 | Ramp Up Long Smooth | 길게 점점 증가 |
| 25 | Ramp Up Medium Smooth | 중간 증가 |
| 26 | Ramp Up Short Smooth | 짧게 증가 |
| 27 | Ramp Down Long Smooth | 길게 감소 |
| 28 | Ramp Down Medium Smooth | 중간 감소 |
| 29 | Ramp Down Short Smooth | 짧게 감소 |

## 반복패턴 (ID 30–32)

| ID | 영어 | 한국어 |
|---|---|---|
| 30 | Strong Click + Buzz | 클릭 후 버즈 |
| 31 | Click + Tick | 클릭 후 틱 |
| 32 | Tick + Click | 틱 후 클릭 |

## 펄스 (ID 33–35)

| ID | 영어 | 한국어 |
|---|---|---|
| 33 | Short Pulse | 짧은 펄스 |
| 34 | Medium Pulse | 중간 펄스 |
| 35 | Long Pulse | 긴 펄스 |

## 반복진동 (ID 36–38)

| ID | 영어 | 한국어 |
|---|---|---|
| 36 | Short Buzz Pattern | 짧은 버즈 패턴 |
| 37 | Medium Buzz Pattern | 중간 버즈 패턴 |
| 38 | Long Buzz Pattern | 긴 버즈 패턴 |

## 리듬 패턴 (ID 39–42)

| ID | 영어 | 한국어 |
|---|---|---|
| 39 | Triple Click | 3번 클릭 |
| 40 | Triple Tick | 3번 틱 |
| 41 | Click Train | 클릭 연속 |
| 42 | Tick Train | 틱 연속 |

## 알림 패턴 (ID 43–47)

| ID | 영어 | 한국어 |
|---|---|---|
| 43 | Alert Pattern 1 | 알림 패턴 1 |
| 44 | Alert Pattern 2 | 알림 패턴 2 |
| 45 | Alert Pattern 3 | 알림 패턴 3 |
| 46 | Alert Pattern 4 | 알림 패턴 4 |
| 47 | Alert Pattern 5 | 알림 패턴 5 |

## 강한 경고 (ID 48–50)

| ID | 영어 | 한국어 |
|---|---|---|
| 48 | Strong Alert | 강한 경고 |
| 49 | Double Alert | 이중 경고 |
| 50 | Triple Alert | 삼중 경고 |

## 충격 (ID 51–53)

| ID | 영어 | 한국어 |
|---|---|---|
| 51 | Strong Impact | 강한 충격 |
| 52 | Medium Impact | 중간 충격 |
| 53 | Soft Impact | 약한 충격 |

## 파형 패턴 (ID 54–55)

| ID | 영어 | 한국어 |
|---|---|---|
| 54 | Rising Pulse | 점점 커지는 펄스 |
| 55 | Falling Pulse | 점점 작아지는 펄스 |

## 버즈 연속 (ID 56–58)

| ID | 영어 | 한국어 |
|---|---|---|
| 56 | Buzz Train | 버즈 연속 |
| 57 | Buzz Burst | 버즈 폭발 |
| 58 | Buzz Ramp | 버즈 증가 |

## 강한 진동 (ID 59–61)

| ID | 영어 | 한국어 |
|---|---|---|
| 59 | Strong Buzz Long | 긴 강한 버즈 |
| 60 | Strong Buzz Medium | 중간 강한 버즈 |
| 61 | Strong Buzz Short | 짧은 강한 버즈 |

## 부드러운 진동 (ID 62–63)

| ID | 영어 | 한국어 |
|---|---|---|
| 62 | Smooth Pulse | 부드러운 펄스 |
| 63 | Smooth Buzz | 부드러운 버즈 |

## 특수 패턴 (ID 64–66)

| ID | 영어 | 한국어 |
|---|---|---|
| 64 | Click Ramp | 클릭 증가 |
| 65 | Tick Ramp | 틱 증가 |
| 66 | Buzz Ramp Down | 버즈 감소 |

## 긴 패턴 (ID 67–69)

| ID | 영어 | 한국어 |
|---|---|---|
| 67 | Long Click Pattern | 긴 클릭 패턴 |
| 68 | Long Buzz Pattern | 긴 버즈 패턴 |
| 69 | Long Alert Pattern | 긴 알림 패턴 |

## 감소 패턴 (ID 70–72)

| ID | 영어 | 한국어 |
|---|---|---|
| 70 | Ramp Down Long Smooth | 길게 감소 |
| 71 | Ramp Down Medium Smooth | 중간 감소 |
| 72 | Ramp Down Short Smooth | 짧게 감소 |

## 반복 상승 (ID 73–75)

| ID | 영어 | 한국어 |
|---|---|---|
| 73 | Ramp Up Repeat | 증가 반복 |
| 74 | Pulse Ramp | 펄스 증가 |
| 75 | Buzz Ramp Up | 버즈 증가 |

## 지속 진동 (ID 76–78)

| ID | 영어 | 한국어 |
|---|---|---|
| 76 | Strong Hum | 강한 지속 진동 |
| 77 | Medium Hum | 중간 지속 진동 |
| 78 | Soft Hum | 약한 지속 진동 |

## 파형 (ID 79–81)

| ID | 영어 | 한국어 |
|---|---|---|
| 79 | Wave Pattern | 파도 패턴 |
| 80 | Pulse Wave | 펄스 파형 |
| 81 | Buzz Wave | 버즈 파형 |

## 증가 진동 (ID 82–84)

| ID | 영어 | 한국어 |
|---|---|---|
| 82 | Ramp Up Long Smooth | 길게 증가 |
| 83 | Ramp Up Medium Smooth | 중간 증가 |
| 84 | Ramp Up Short Smooth | 짧게 증가 |

## 짧은 패턴 (ID 85–87)

| ID | 영어 | 한국어 |
|---|---|---|
| 85 | Short Click Pattern | 짧은 클릭 패턴 |
| 86 | Short Buzz Pattern | 짧은 버즈 패턴 |
| 87 | Short Pulse Pattern | 짧은 펄스 패턴 |

## 빠른 반복 (ID 88–90)

| ID | 영어 | 한국어 |
|---|---|---|
| 88 | Rapid Buzz | 빠른 버즈 |
| 89 | Rapid Pulse | 빠른 펄스 |
| 90 | Rapid Click | 빠른 클릭 |

## 복합 패턴 (ID 91–93)

| ID | 영어 | 한국어 |
|---|---|---|
| 91 | Click Buzz Combo | 클릭 + 버즈 |
| 92 | Tick Buzz Combo | 틱 + 버즈 |
| 93 | Pulse Buzz Combo | 펄스 + 버즈 |

## 강한 반복 (ID 94–96)

| ID | 영어 | 한국어 |
|---|---|---|
| 94 | Strong Buzz Train | 강한 버즈 연속 |
| 95 | Strong Pulse Train | 강한 펄스 연속 |
| 96 | Strong Click Train | 강한 클릭 연속 |

## 약한 반복 (ID 97–99)

| ID | 영어 | 한국어 |
|---|---|---|
| 97 | Soft Buzz Train | 약한 버즈 연속 |
| 98 | Soft Pulse Train | 약한 펄스 연속 |
| 99 | Soft Click Train | 약한 클릭 연속 |

## 긴 반복 (ID 100–102)

| ID | 영어 | 한국어 |
|---|---|---|
| 100 | Long Buzz Train | 긴 버즈 연속 |
| 101 | Long Pulse Train | 긴 펄스 연속 |
| 102 | Long Click Train | 긴 클릭 연속 |

## 지속 진동 (ID 103–105)

| ID | 영어 | 한국어 |
|---|---|---|
| 103 | Smooth Hum Strong | 강한 지속 진동 |
| 104 | Smooth Hum Medium | 중간 지속 진동 |
| 105 | Smooth Hum Soft | 약한 지속 진동 |

## 알림 패턴 (ID 106–108)

| ID | 영어 | 한국어 |
|---|---|---|
| 106 | Notification 1 | 알림 패턴 1 |
| 107 | Notification 2 | 알림 패턴 2 |
| 108 | Notification 3 | 알림 패턴 3 |

## 시스템 패턴 (ID 109–111)

| ID | 영어 | 한국어 |
|---|---|---|
| 109 | System Click | 시스템 클릭 |
| 110 | System Alert | 시스템 알림 |
| 111 | System Warning | 시스템 경고 |

## 프로그램용 (ID 112–114)

| ID | 영어 | 한국어 |
|---|---|---|
| 112 | Programmatic Pulse | 프로그램 펄스 |
| 113 | Programmatic Buzz | 프로그램 버즈 |
| 114 | Programmatic Click | 프로그램 클릭 |

## 종료용 (ID 115–118)

| ID | 영어 | 한국어 |
|---|---|---|
| 115 | End Pulse | 종료 펄스 |
| 116 | End Buzz | 종료 버즈 |
| 117 | End Click | 종료 클릭 |
| 118 | Long Buzz for programmatic stopping | 프로그램 종료용 긴 버즈 |

## 지속 진동 (ID 119–123)

| ID | 영어 | 한국어 |
|---|---|---|
| 119 | Smooth Hum 50% | 부드러운 지속 진동 |
| 120 | Smooth Hum 40% | 약한 지속 진동 |
| 121 | Smooth Hum 30% | 더 약한 지속 진동 |
| 122 | Smooth Hum 20% | 매우 약한 지속 진동 |
| 123 | Smooth Hum 10% | 최소 진동 |

---

### 용도별 추천 이펙트

| 용도 | 추천 ID | 이름 |
|---|---|---|
| 버튼 터치 | 1, 4 | Strong Click, Sharp Click |
| 가벼운 터치 | 2, 7 | Strong Click 60%, Soft Bump |
| 확인 피드백 | 10 | Double Click 100% |
| 알림 | 43~47 | Alert Pattern 1~5 |
| 경고 | 48~50 | Strong/Double/Triple Alert |
| 스크롤 | 13~15 | Sharp Tick |
| 전환 효과 | 24~29 | Ramp Up/Down |
| 지속 진동 | 76~78, 119~123 | Hum 시리즈 |
| 게임 충격 | 51~53 | Impact 시리즈 |

---

*참고: TI DRV2605L Datasheet (SLOS854D), TI Application Note SLOA189*
