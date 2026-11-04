# 디자인 시스템 적용 기록

## 참조 파일

- [iOS 27 Builder UI Kit](https://www.figma.com/design/ZKSQz4nsm1jbpJvOgSsKE4): Native Components `15:0`; Menus and actions `6171:449`; Navigation and search `6171:452`; Selection and input `6171:458`.
- [사용자 제공 두 번째 파일](https://www.figma.com/design/AmStZVrXJOT2OJr8y5R10Y/Untitled?node-id=0-1): 재확인 시 Header `2:12`, Alert `2:166`, Group Box `2:189`, Combo Box `2:599`, Large `2:2431`, Small `2:2865`, List Item `2:2979`가 존재했다. Large의 고해상도 디자인 컨텍스트와 렌더를 확인했다.

첫 조사에서는 두 번째 파일이 비어 있었으나 사용자 재전달 후 채워진 구조를 확인했다. 현재 구현은 업데이트된 파일을 참조한다.

## 웹 대응

| 원본 패턴 | 웹 구현 |
| --- | --- |
| macOS sidebar with selected row | 고정 데스크톱 워크스페이스 사이드바, 선택 배경과 활성점 |
| Search Field | 둥근 테두리 검색창, 검색 아이콘, Cmd/Ctrl+K 진입 |
| Button and Popup Button | shadcn 패턴 Button, 접근 가능한 native select |
| Segmented Control | AI 학습/대화 모드 radio 선택 |
| Menu / Alert / sheet | Radix Dialog의 포커스 관리, ESC 닫기와 반투명 오버레이 |
| List and disclosure | 질문 행과 독립 답안 토글, native details 꼬리질문 |
| grouped fields | 지원 정보 폼, 분석 검토, 개인 질문 편집 |

원본의 SwiftUI 전용 Code Connect 래퍼는 웹에서 실행 가능한 컴포넌트가 아니다. 새 저장소에 대응 코드가 없음을 확인했고, 웹에 적합한 React/Radix 패턴으로 재구성했다. 완성된 면접 플랫폼 화면이 Figma에 존재한다고 가정해 복제하지 않았다.

## 토큰과 접근성

`app/globals.css`의 CSS 변수가 단일 토큰 원본이다. 배경은 화이트/슬레이트, 액센트는 인디고, 정보 계층은 primary/secondary/muted로 구분한다. 앱 사이드바, 검색, 메뉴의 둥근 모서리를 활용하고 긴 텍스트는 불투명 표면에 표시한다. 라이트/다크 및 reduced motion을 지원한다.

버튼과 다이얼로그는 `components/ui/`, 탐색은 `components/layout/`에서 재사용한다. 키보드 포커스, skip link, 모달 focus trap, 명시적 필드 라벨과 버튼 이름을 제공한다. 모바일에서는 전역 탐색을 Drawer로 바꾸고 질문 카테고리를 접을 수 있게 한다.

홈의 문서/질문 미리보기는 CSS와 Lucide로 만든 설명용 장식이며 실제 업로드나 생성 결과로 표시하지 않는다. Figma 렌더 이미지를 제품 구현 자산으로 사용하지 않았고, 런타임에서 임시 Figma 자산 URL을 참조하지 않는다. 사용한 Figma 패턴에는 필수 사진/비트맵이 없다.

요청한 hallmark/impeccable 스킬은 설치된 로컬/플러그인 스킬 목록과 파일 검색에서 발견되지 않았다. 별도 스킬을 임의로 설치하거나 적용했다고 주장하지 않는다.
