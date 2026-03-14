생성한 진동패턴 라이브러리 저장하는 곳

class: 패턴종류
type: library render, RTP render, Hybrid render 중 선택

(library render: 라이브러리만 사용)
(RTP render: RTP(실시간 직접제어)만 사용)
(Hybrid render: 둘 다 사용)

ex)
| class | type | pattern code (copy C Array) | JSON |
| 불꽃놀이 | RTP render | 


| 15 25
30 25
55 25
90 25
135 22
180 22
225 18
190 18
140 20
0 70 |

| const uint8_t rtp_pattern[] = {
  15, 25, 30, 25, 55, 25, 90, 25, 135, 22, 180, 22,
  225, 18, 190, 18, 140, 20, 0, 70
}; |

|
{
  "version": 1,
  "points": [
    {
      "amp": 15,
      "dur": 25
    },
    {
      "amp": 30,
      "dur": 25
    },
    {
      "amp": 55,
      "dur": 25
    },
    {
      "amp": 90,
      "dur": 25
    },
    {
      "amp": 135,
      "dur": 22
    },
    {
      "amp": 180,
      "dur": 22
    },
    {
      "amp": 225,
      "dur": 18
    },
    {
      "amp": 190,
      "dur": 18
    },
    {
      "amp": 140,
      "dur": 20
    },
    {
      "amp": 0,
      "dur": 70
    }
  ],
  "total_duration_ms": 270
} |