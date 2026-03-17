
# 📝 TIL (Today I Learned): 인프라 아키텍처 및 CI/CD 구축 기반 다지기

## 1. 로컬 개발 환경 세팅 (SSH 터널링)

* **목적:** 팀원들이 AWS 보안 그룹(포트) 개방 없이, 22번 포트만으로 안전하게 EC2 내부의 Dev DB(MySQL)에 접속하여 개발할 수 있도록 구성.
* **해결책:** `Standard TCP/IP over SSH` 방식을 활용한 백그라운드 터널링 구축.
* **자동화 스크립트 작성:** 팀원 배포용 윈도우 배치 파일(`.bat`) 완성.
* 폴더 내 `.pem` 키를 이름 상관없이 자동 탐색하도록 스크립트 고도화.
* `chcp 65001`을 적용하여 CMD 터미널 한글 깨짐 문제 해결.
* `ssh -i "%PEM_FILE%" -N -L 13306:127.0.0.1:13306 ubuntu@IP` 명령어로 백그라운드 터널링 유지.



## 2. Spring Boot 환경 변수 관리 전략 (.env)

* **목적:** DB 비밀번호 등 민감 정보가 깃랩(GitLab) 레포지토리에 하드코딩되어 올라가는 보안 사고 방지.
* **해결책:**
* `application.yml`에는 `${DB_URL}`, `${DB_PASSWORD}` 처럼 변수명만 작성하여 Git에 당당하게 커밋.
* 실제 민감 정보는 프로젝트 최상단 루트의 `.env` 파일로 분리하고 `.gitignore`에 반드시 등록.
* **CI/CD 연계:** 추후 젠킨스(Jenkins) 파이프라인에서 브랜치(`dev`, `master`)를 자동으로 인식하여, 각 환경에 맞는 `.env` 파일을 동적으로 생성 후 주입하는 방식으로 아키텍처 설계 완료.
.


## 3. 인프라 네트워크 & Nginx 라우팅 (Blue-Green 준비)

* **도커 네트워크 분리:** `dev-net`, `prod-net`, `jenkins-net` 등 사용자 정의 브릿지 네트워크를 생성. 환경 간 완벽한 격리(Isolation)와 컨테이너 이름 기반 통신(내부 DNS) 확보.
* **Nginx 리버스 프록시 세팅:**
* 외부 관문은 `80`, `443` 포트로 정석대로 개방하고, 내부 서비스(DB, Redis 등)는 외부에서 접근 불가능하도록 철저히 숨김.
* **MinIO 스토리지 연동:** `client_max_body_size 500M;` 설정을 통해 영상/음성 파일 업로드 제한 해제 및 9000번 포트 라우팅 뼈대 작성.
* **무중단 배포 스위칭 대비:** `upstream backend` 블록을 구성하여, 추후 Jenkins가 `8080(Blue)`과 `8081(Green)`을 동적으로 스위칭(`reload`)할 수 있도록 기반 설정 마련.



## 4. Jenkins CI/CD 파이프라인 전략 구성

* **전략:** GitLab과 연동하여 `dev` 브랜치와 `master` 브랜치별 배포 흐름을 다르게 가져감.
* **Multibranch Pipeline 도입:** 브랜치마다 Item(작업장)을 일일이 만들지 않고, Jenkins가 레포지토리를 자동 스캔하여 브랜치별로 `Jenkinsfile` 흐름을 분기 처리하는 스마트한 파이프라인 방식 채택.
* **현재 진행 상태:** `GitLab`, `Docker Pipeline` 플러그인 설치 대기 및 Jenkins 컨테이너의 Docker Socket 연동(`- /var/run/docker.sock`) 확인 완료.

---

### 🚀 Next Step

1. Jenkins 시스템에 GitLab 접근 권한(Token) 및 환경별 비밀번호 세팅 (Credentials 금고 등록).
2. Jenkins Multibranch Pipeline 생성 및 GitLab Webhook 연동.
3. Blue-Green 스위칭 및 동적 `.env` 생성을 포함한 `Jenkinsfile` 배포 스크립트 작성.

---
