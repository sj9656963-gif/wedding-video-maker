// 공용 타입 정의

export type TransitionType =
  | 'crossfade'
  | 'dip-white'
  | 'dip-black'
  | 'push'
  | 'zoom'
  /** 빛을 머금은 얇은 베일이 물결치며 지나가고, 그 뒤로 다음 장면이 드러남 */
  | 'veil'
  /** 부드러운 원형으로 열림 */
  | 'iris'
  /** 부드러운 사선 닦아내기 */
  | 'wipe'
  /** 흐려졌다가 선명해지는 몽환적인 전환 */
  | 'blur'
  /** 빛 번짐(라이트 릭) */
  | 'light'
  /** 꽃잎(스타일의 파티클)이 흩날리며 넘어감 */
  | 'petals'
  /** 화면이 가로로 찢어지는 디지털 글리치 */
  | 'glitch'
  /** 가로로 길게 번지는 렌즈 플레어 */
  | 'flare'
  /** 비디오테이프가 감기듯 위로 흐름 */
  | 'tracking'
  /** 잉크가 번지듯 퍼지며 열림 */
  | 'ink'
  /** 블라인드처럼 세로 띠가 차례로 열림 */
  | 'blinds'
  /** 새 장면이 옆에서 미끄러져 들어와 덮음 */
  | 'slide'
  /** 가운데서 양쪽으로 문이 열리듯 */
  | 'split'
  /** 카메라 플래시처럼 하얗게 번쩍 */
  | 'flash'
  /** 모자이크(픽셀)로 흩어졌다 모임 */
  | 'mosaic'
  /** 반짝이가 흩뿌려지며 넘어감 */
  | 'sparkle'
  /** 필름이 타들어 가듯 따뜻한 빛이 번짐 */
  | 'filmburn'
  /** 살포시 떠오르며 나타남 */
  | 'rise'
  /** 시계 방향으로 닦아내기 */
  | 'clock';

export type MotionType = 'zoom-in' | 'zoom-out' | 'pan-left' | 'pan-right' | 'pan-up' | 'pan-down';

/**
 * 장면 배치
 * - cover: 가로 사진을 화면 가득 / contain: 흐린 배경 위 액자 / pair: 두 장 나란히
 * - polaroid: 폴라로이드 1~3장 / collage: 3장 콜라주 / grid: 4장 모자이크
 * - oval: 타원형 액자(카메오) / magazine: 사진 + 글 패널 / filmstrip: 흐르는 필름 4장
 * - poster: 큰 글자 위 사진 포스터 / sticker: 스티커처럼 오려 붙인 2~3장
 * - gallery: 전시장 벽에 걸린 액자 1~3점 / arch: 아치형 창 안의 사진과 식물 장식
 */
export type SceneLayout =
  | 'cover'
  | 'contain'
  | 'pair'
  | 'polaroid'
  | 'collage'
  | 'grid'
  | 'oval'
  | 'magazine'
  | 'filmstrip'
  | 'poster'
  | 'sticker'
  | 'gallery'
  | 'arch';

/** 켄번스(천천히 확대/이동) 움직임. fx/fy는 -1~1 범위의 초점(여유 공간 대비 비율). */
export interface Motion {
  type: MotionType;
  fx: number;
  fy: number;
}

/** 이전 장면에서 이 장면으로 넘어올 때의 전환 효과 */
export interface Transition {
  type: TransitionType;
  duration: number;
  direction: 1 | -1;
}

interface SegmentBase {
  start: number;
  end: number;
  /** 이 구간이 시작될 때 적용되는 전환 (첫 구간은 null) */
  transitionIn: Transition | null;
  motion: Motion;
  /**
   * 움직임 진행도를 계산할 구간. 오프닝/엔딩과 바로 옆 장면이 같은 사진이면 두 구간이 같은 값을 가져
   * 사진이 끊김 없이 이어지고, 전환 중에는 어둡게 한 막과 문구만 사라지거나 나타남.
   */
  motionSpan?: { start: number; end: number };
}

export interface TitleSegment extends SegmentBase {
  kind: 'intro' | 'outro';
  photoId: string | null;
}

export interface PhotoSegment extends SegmentBase {
  kind: 'photo';
  /** 장면 번호 (0부터) */
  index: number;
  photoIds: string[];
  layout: SceneLayout;
  /** 같은 배치 안에서의 변형(좌우 반전, 기울기 등) */
  variant: number;
  /** 사진이 부족해 반복 사용된 장면인지 */
  repeat: boolean;
  /** 장면과 함께 보여줄 감성 문구 */
  quote?: string;
  /** 촬영 연도가 바뀌는 장면이면 그 연도 */
  year?: number;
}

export type Segment = TitleSegment | PhotoSegment;

export interface Timeline {
  duration: number;
  segments: Segment[];
  /** 가중치 1 장면의 표시 시간(전환 포함) */
  sceneDuration: number;
  /** 사진 장면의 평균 표시 시간 */
  averageSceneDuration: number;
  /** 사진 장면 사이 전환 시간 */
  transitionDuration: number;
  /** 인트로/엔딩 전환 시간 */
  titleTransitionDuration: number;
  photoCount: number;
  sceneCount: number;
  repeatedScenes: number;
  /** 감성 문구가 들어간 장면 수 */
  quoteCount: number;
  /** 사용된 배치 종류 수 */
  layoutCount: number;
}

export interface WeddingInfo {
  groom: string;
  bride: string;
  /** YYYY-MM-DD */
  date: string;
  /** HH:MM (24시간) */
  time: string;
  venue: string;
  introTitle: string;
  /** 엔딩 제목 (비우면 스타일 기본 문구) */
  outroTitle: string;
  outroMessage: string;
  outroNotice: string;
  /** 영상 중간에 넣을 감성 문구 (한 줄에 하나) */
  quotes: string;
}

export interface PhotoItem {
  id: string;
  file: File;
  name: string;
  /** 방향(EXIF 회전)이 반영된 원본 크기 */
  width: number;
  height: number;
  /** 방향(EXIF 회전)이 반영된 가로/세로 비율 */
  aspect: number;
  /** 촬영 시각 (EXIF, epoch ms). 정렬·연도 챕터에만 쓰고 사진 위에 날짜를 적지는 않음 */
  dateTaken: number | null;
  lastModified: number;
  thumbUrl: string;
  addedIndex: number;
  /** 사용자가 이 사진에 넣은 짧은 문구 (폴라로이드 아래, 액자 라벨 등에 표시). 비어 있으면 표시하지 않음 */
  caption: string;
}
