import type { SVGProps } from "react";

type IllustrationProps = SVGProps<SVGSVGElement>;

const PRIMARY = "#5B4CFF";
const SECONDARY = "#8D83FF";
const ACCENT = "#A89DFF";
const LIGHT = "#F6F4FF";
const STROKE = "rgba(91,76,255,0.12)";
const INK = "#17132F";
const SKIN = "#F0C8B8";
const HAIR = "#2E245B";
const SHIRT = "#FFFFFF";

function IllustrationShell({
  id,
  children,
  ...props
}: IllustrationProps & {
  id: string;
  children: React.ReactNode;
}) {
  return (
    <svg
      viewBox="0 0 256 256"
      fill="none"
      role="img"
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <defs>
        <linearGradient id={`${id}-primary`} x1="40" y1="28" x2="210" y2="228">
          <stop stopColor={PRIMARY} />
          <stop offset="1" stopColor={ACCENT} />
        </linearGradient>
        <linearGradient id={`${id}-soft`} x1="54" y1="24" x2="202" y2="220">
          <stop stopColor={LIGHT} />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity="0.6" />
        </linearGradient>
        <linearGradient id={`${id}-glass`} x1="48" y1="48" x2="208" y2="208">
          <stop stopColor="#FFFFFF" stopOpacity="0.96" />
          <stop offset="1" stopColor={LIGHT} stopOpacity="0.86" />
        </linearGradient>
        <filter
          id={`${id}-shadow`}
          x="-20%"
          y="-20%"
          width="140%"
          height="150%"
          colorInterpolationFilters="sRGB"
        >
          <feDropShadow dx="0" dy="14" stdDeviation="14" floodColor="#5B4CFF" floodOpacity="0.14" />
        </filter>
      </defs>
      {children}
    </svg>
  );
}

function Person({
  x,
  y,
  scale = 1,
  variant = "default",
  pose = "typing",
}: {
  x: number;
  y: number;
  scale?: number;
  variant?: "default" | "shortHair" | "bun" | "cap";
  pose?: "typing" | "holding" | "drawing" | "speaking" | "controller";
}) {
  const armPath =
    pose === "drawing"
      ? "M38 72C56 68 68 60 78 48"
      : pose === "holding"
        ? "M36 72C52 82 66 80 78 70"
        : pose === "speaking"
          ? "M34 70C48 58 60 56 72 64"
          : pose === "controller"
            ? "M35 72C50 78 64 78 79 72"
            : "M36 72C50 76 64 76 78 72";

  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <path
        d="M30 122C31 92 38 67 62 67C86 67 94 92 95 122H30Z"
        fill={SHIRT}
        stroke={STROKE}
        strokeWidth="2.5"
      />
      <path d="M43 72C48 86 76 86 82 72" stroke={SECONDARY} strokeWidth="2.5" strokeLinecap="round" />
      <path d={armPath} stroke={SKIN} strokeWidth="9" strokeLinecap="round" />
      <path d="M28 84C38 78 48 76 58 82" stroke={SKIN} strokeWidth="9" strokeLinecap="round" />
      <circle cx="63" cy="42" r="23" fill={SKIN} />
      {variant === "bun" ? (
        <>
          <path d="M38 42C38 21 52 12 70 17C89 22 96 42 86 58C78 42 57 36 38 42Z" fill={HAIR} />
          <circle cx="88" cy="23" r="9" fill={HAIR} />
        </>
      ) : variant === "shortHair" ? (
        <path d="M39 37C43 18 63 11 80 21C92 28 91 44 86 55C78 37 58 33 39 37Z" fill={HAIR} />
      ) : variant === "cap" ? (
        <>
          <path d="M38 36C43 20 60 14 78 22C89 27 91 43 85 57C76 39 58 32 38 36Z" fill={HAIR} />
          <path d="M39 32C50 18 72 18 84 32C70 29 54 29 39 32Z" fill={`url(#drone-operator-primary)`} />
        </>
      ) : (
        <path d="M38 43C37 20 55 10 76 17C93 23 96 47 86 61C76 39 56 34 38 43Z" fill={HAIR} />
      )}
      <circle cx="55" cy="44" r="2" fill={INK} />
      <circle cx="72" cy="44" r="2" fill={INK} />
      <path d="M58 55C62 58 68 58 72 55" stroke={INK} strokeWidth="2" strokeLinecap="round" />
    </g>
  );
}

function WindowCard({
  x,
  y,
  width,
  height,
  id,
  children,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  id: string;
  children?: React.ReactNode;
}) {
  return (
    <g filter={`url(#${id}-shadow)`}>
      <rect x={x} y={y} width={width} height={height} rx="18" fill={`url(#${id}-glass)`} stroke={STROKE} strokeWidth="2.5" />
      <circle cx={x + 17} cy={y + 18} r="3" fill={ACCENT} opacity="0.7" />
      <circle cx={x + 29} cy={y + 18} r="3" fill={SECONDARY} opacity="0.45" />
      {children}
    </g>
  );
}

function Stars({ id }: { id: string }) {
  return (
    <g opacity="0.55">
      <path d="M213 47L216 54L223 57L216 60L213 67L210 60L203 57L210 54L213 47Z" fill={`url(#${id}-primary)`} opacity="0.28" />
      <circle cx="44" cy="52" r="4" fill={ACCENT} opacity="0.25" />
      <circle cx="220" cy="188" r="5" fill={SECONDARY} opacity="0.14" />
    </g>
  );
}

export function VideoEditorIllustration(props: IllustrationProps) {
  const id = "video-editor";

  return (
    <IllustrationShell id={id} {...props}>
      <Stars id={id} />
      <WindowCard id={id} x={50} y={38} width={156} height={110}>
        <rect x="70" y="68" width="116" height="52" rx="13" fill={`url(#${id}-primary)`} opacity="0.16" />
        <path d="M121 82L145 96L121 110V82Z" fill={PRIMARY} opacity="0.9" />
        <rect x="70" y="131" width="35" height="5" rx="2.5" fill={PRIMARY} opacity="0.22" />
        <rect x="110" y="131" width="76" height="5" rx="2.5" fill={SECONDARY} opacity="0.18" />
      </WindowCard>
      <g filter={`url(#${id}-shadow)`}>
        <rect x="42" y="148" width="172" height="44" rx="16" fill="#FFFFFF" stroke={STROKE} strokeWidth="2.5" />
        <rect x="58" y="163" width="42" height="10" rx="5" fill={PRIMARY} opacity="0.28" />
        <rect x="108" y="163" width="64" height="10" rx="5" fill={SECONDARY} opacity="0.22" />
        <rect x="180" y="163" width="18" height="10" rx="5" fill={ACCENT} opacity="0.34" />
        <path d="M84 151V189" stroke={PRIMARY} strokeWidth="2.5" strokeLinecap="round" opacity="0.35" />
        <path d="M184 177L197 164M184 164L197 177" stroke={PRIMARY} strokeWidth="2.4" strokeLinecap="round" />
        <circle cx="184" cy="164" r="4" fill="#FFFFFF" stroke={PRIMARY} strokeWidth="2" />
        <circle cx="197" cy="177" r="4" fill="#FFFFFF" stroke={PRIMARY} strokeWidth="2" />
      </g>
      <Person x={78} y={105} scale={0.72} variant="bun" pose="typing" />
    </IllustrationShell>
  );
}

export function VideographerIllustration(props: IllustrationProps) {
  const id = "videographer";

  return (
    <IllustrationShell id={id} {...props}>
      <Stars id={id} />
      <WindowCard id={id} x={50} y={44} width={154} height={106}>
        <rect x="70" y="74" width="64" height="52" rx="12" fill={LIGHT} stroke={STROKE} strokeWidth="2" />
        <path d="M77 118L95 98L111 112L121 103L130 118H77Z" fill={`url(#${id}-primary)`} opacity="0.35" />
        <circle cx="116" cy="86" r="6" fill={ACCENT} opacity="0.55" />
        <rect x="145" y="75" width="38" height="10" rx="5" fill={PRIMARY} opacity="0.18" />
        <rect x="145" y="93" width="28" height="10" rx="5" fill={SECONDARY} opacity="0.18" />
      </WindowCard>
      <g filter={`url(#${id}-shadow)`}>
        <rect x="40" y="157" width="55" height="42" rx="14" fill="#FFFFFF" stroke={STROKE} strokeWidth="2.5" />
        <path d="M47 190L62 174L74 186L82 178L90 190H47Z" fill={PRIMARY} opacity="0.22" />
        <rect x="168" y="145" width="52" height="40" rx="14" fill="#FFFFFF" stroke={STROKE} strokeWidth="2.5" />
        <path d="M176 177L190 159L204 176H176Z" fill={SECONDARY} opacity="0.28" />
      </g>
      <Person x={82} y={98} scale={0.82} variant="shortHair" pose="holding" />
      <g transform="translate(107 151)" filter={`url(#${id}-shadow)`}>
        <rect x="0" y="0" width="58" height="39" rx="12" fill={INK} />
        <circle cx="28" cy="20" r="11" fill="#FFFFFF" opacity="0.92" />
        <circle cx="28" cy="20" r="6" fill={PRIMARY} opacity="0.8" />
        <rect x="41" y="9" width="16" height="12" rx="4" fill={PRIMARY} />
      </g>
    </IllustrationShell>
  );
}

export function GraphicDesignerIllustration(props: IllustrationProps) {
  const id = "graphic-designer";

  return (
    <IllustrationShell id={id} {...props}>
      <Stars id={id} />
      <WindowCard id={id} x={44} y={42} width={168} height={120}>
        <rect x="69" y="72" width="76" height="64" rx="16" fill={LIGHT} stroke={STROKE} strokeWidth="2" />
        <path d="M89 119C101 93 115 101 127 80" stroke={`url(#${id}-primary)`} strokeWidth="5" strokeLinecap="round" />
        <circle cx="160" cy="82" r="7" fill={PRIMARY} opacity="0.75" />
        <circle cx="178" cy="82" r="7" fill={SECONDARY} opacity="0.65" />
        <circle cx="160" cy="104" r="7" fill={ACCENT} opacity="0.55" />
        <rect x="154" y="122" width="31" height="7" rx="3.5" fill={PRIMARY} opacity="0.18" />
      </WindowCard>
      <g filter={`url(#${id}-shadow)`}>
        <rect x="58" y="159" width="140" height="40" rx="17" fill="#FFFFFF" stroke={STROKE} strokeWidth="2.5" />
        <rect x="80" y="171" width="74" height="14" rx="7" fill={PRIMARY} opacity="0.18" />
        <path d="M162 185L185 162" stroke={PRIMARY} strokeWidth="4" strokeLinecap="round" />
        <path d="M184 162L190 168" stroke={PRIMARY} strokeWidth="4" strokeLinecap="round" />
      </g>
      <Person x={80} y={105} scale={0.74} variant="bun" pose="drawing" />
    </IllustrationShell>
  );
}

export function WebDeveloperIllustration(props: IllustrationProps) {
  const id = "web-developer";

  return (
    <IllustrationShell id={id} {...props}>
      <Stars id={id} />
      <WindowCard id={id} x={42} y={44} width={172} height={104}>
        <rect x="62" y="75" width="68" height="48" rx="12" fill={INK} opacity="0.94" />
        <path d="M75 91L67 99L75 107M115 91L123 99L115 107" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M98 88L91 110" stroke={ACCENT} strokeWidth="3" strokeLinecap="round" />
        <rect x="143" y="77" width="48" height="9" rx="4.5" fill={PRIMARY} opacity="0.18" />
        <rect x="143" y="94" width="37" height="9" rx="4.5" fill={SECONDARY} opacity="0.18" />
        <rect x="143" y="111" width="27" height="9" rx="4.5" fill={ACCENT} opacity="0.22" />
      </WindowCard>
      <g filter={`url(#${id}-shadow)`}>
        <rect x="67" y="154" width="122" height="48" rx="15" fill="#FFFFFF" stroke={STROKE} strokeWidth="2.5" />
        <rect x="77" y="163" width="102" height="27" rx="8" fill={LIGHT} />
        <path d="M73 202H183" stroke={PRIMARY} strokeWidth="4" strokeLinecap="round" opacity="0.18" />
      </g>
      <Person x={82} y={104} scale={0.77} variant="shortHair" pose="typing" />
      <g opacity="0.62">
        <rect x="193" y="139" width="28" height="8" rx="4" fill={PRIMARY} opacity="0.24" />
        <rect x="31" y="128" width="34" height="8" rx="4" fill={SECONDARY} opacity="0.2" />
      </g>
    </IllustrationShell>
  );
}

export function MotionDesignerIllustration(props: IllustrationProps) {
  const id = "motion-designer";

  return (
    <IllustrationShell id={id} {...props}>
      <Stars id={id} />
      <WindowCard id={id} x={45} y={38} width={166} height={112}>
        <rect x="66" y="68" width="70" height="48" rx="14" fill={`url(#${id}-primary)`} opacity="0.16" />
        <circle cx="101" cy="92" r="16" fill="#FFFFFF" stroke={PRIMARY} strokeWidth="2.5" opacity="0.9" />
        <path d="M97 84L109 92L97 100V84Z" fill={PRIMARY} />
        <path d="M153 113C163 83 175 104 190 76" stroke={PRIMARY} strokeWidth="3" strokeLinecap="round" />
        <circle cx="153" cy="113" r="4" fill={PRIMARY} />
        <circle cx="172" cy="95" r="4" fill={SECONDARY} />
        <circle cx="190" cy="76" r="4" fill={ACCENT} />
      </WindowCard>
      <g filter={`url(#${id}-shadow)`}>
        <rect x="49" y="155" width="158" height="40" rx="15" fill="#FFFFFF" stroke={STROKE} strokeWidth="2.5" />
        <path d="M68 175H188" stroke={PRIMARY} strokeWidth="2.5" strokeLinecap="round" opacity="0.24" />
        <circle cx="89" cy="175" r="5" fill={PRIMARY} opacity="0.8" />
        <circle cx="128" cy="175" r="5" fill={SECONDARY} opacity="0.8" />
        <circle cx="168" cy="175" r="5" fill={ACCENT} opacity="0.8" />
      </g>
      <Person x={78} y={107} scale={0.72} variant="default" pose="typing" />
    </IllustrationShell>
  );
}

export function DroneOperatorIllustration(props: IllustrationProps) {
  const id = "drone-operator";

  return (
    <IllustrationShell id={id} {...props}>
      <Stars id={id} />
      <path d="M43 143L92 95L127 143H43Z" fill={LIGHT} stroke={STROKE} strokeWidth="2.5" />
      <path d="M110 143L163 86L214 143H110Z" fill="#FFFFFF" stroke={STROKE} strokeWidth="2.5" />
      <path d="M54 167C83 147 120 152 147 164C171 175 195 174 216 162" stroke={PRIMARY} strokeWidth="3" strokeLinecap="round" opacity="0.22" />
      <g filter={`url(#${id}-shadow)`}>
        <rect x="87" y="50" width="82" height="25" rx="12.5" fill="#FFFFFF" stroke={STROKE} strokeWidth="2.5" />
        <path d="M128 62H84M128 62H172" stroke={PRIMARY} strokeWidth="3" strokeLinecap="round" />
        <circle cx="77" cy="62" r="9" fill={LIGHT} stroke={PRIMARY} strokeWidth="2" />
        <circle cx="179" cy="62" r="9" fill={LIGHT} stroke={PRIMARY} strokeWidth="2" />
        <circle cx="128" cy="62" r="6" fill={PRIMARY} />
      </g>
      <path d="M187 91C171 107 176 124 156 135" stroke={PRIMARY} strokeWidth="2.5" strokeDasharray="5 7" strokeLinecap="round" opacity="0.36" />
      <Person x={76} y={104} scale={0.79} variant="cap" pose="controller" />
      <g transform="translate(103 169)" filter={`url(#${id}-shadow)`}>
        <rect x="0" y="0" width="62" height="28" rx="12" fill="#FFFFFF" stroke={STROKE} strokeWidth="2.5" />
        <circle cx="18" cy="14" r="5" fill={PRIMARY} opacity="0.72" />
        <circle cx="44" cy="14" r="5" fill={SECONDARY} opacity="0.72" />
      </g>
    </IllustrationShell>
  );
}

export function ContentWriterIllustration(props: IllustrationProps) {
  const id = "content-writer";

  return (
    <IllustrationShell id={id} {...props}>
      <Stars id={id} />
      <WindowCard id={id} x={52} y={42} width={152} height={114}>
        <rect x="73" y="73" width="92" height="9" rx="4.5" fill={PRIMARY} opacity="0.18" />
        <rect x="73" y="92" width="112" height="8" rx="4" fill={SECONDARY} opacity="0.16" />
        <rect x="73" y="109" width="98" height="8" rx="4" fill={ACCENT} opacity="0.18" />
        <rect x="73" y="126" width="68" height="8" rx="4" fill={PRIMARY} opacity="0.14" />
      </WindowCard>
      <g filter={`url(#${id}-shadow)`}>
        <rect x="46" y="153" width="74" height="49" rx="16" fill="#FFFFFF" stroke={STROKE} strokeWidth="2.5" />
        <path d="M62 169H99M62 183H92" stroke={PRIMARY} strokeWidth="3" strokeLinecap="round" opacity="0.22" />
        <rect x="129" y="159" width="82" height="37" rx="14" fill="#FFFFFF" stroke={STROKE} strokeWidth="2.5" />
        <path d="M144 174H194M144 187H176" stroke={SECONDARY} strokeWidth="3" strokeLinecap="round" opacity="0.26" />
      </g>
      <Person x={79} y={104} scale={0.76} variant="bun" pose="typing" />
      <path d="M148 179L166 169" stroke={PRIMARY} strokeWidth="3" strokeLinecap="round" />
    </IllustrationShell>
  );
}

export function SocialMediaMarketerIllustration(props: IllustrationProps) {
  const id = "social-media-marketer";

  return (
    <IllustrationShell id={id} {...props}>
      <Stars id={id} />
      <g filter={`url(#${id}-shadow)`}>
        <rect x="99" y="36" width="76" height="132" rx="24" fill="#FFFFFF" stroke={STROKE} strokeWidth="2.5" />
        <rect x="111" y="58" width="52" height="48" rx="14" fill={`url(#${id}-primary)`} opacity="0.16" />
        <circle cx="124" cy="126" r="7" fill={PRIMARY} opacity="0.22" />
        <circle cx="144" cy="126" r="7" fill={SECONDARY} opacity="0.22" />
        <path d="M118 147C127 133 139 140 145 128C150 118 158 120 162 112" stroke={PRIMARY} strokeWidth="3" strokeLinecap="round" />
      </g>
      <g filter={`url(#${id}-shadow)`}>
        <rect x="47" y="76" width="49" height="38" rx="14" fill="#FFFFFF" stroke={STROKE} strokeWidth="2.5" />
        <path d="M62 94H82M62 105H76" stroke={PRIMARY} strokeWidth="3" strokeLinecap="round" opacity="0.22" />
        <rect x="167" y="139" width="47" height="37" rx="14" fill="#FFFFFF" stroke={STROKE} strokeWidth="2.5" />
        <path d="M181 160C187 151 195 156 201 146" stroke={SECONDARY} strokeWidth="3" strokeLinecap="round" />
      </g>
      <Person x={64} y={107} scale={0.73} variant="shortHair" pose="holding" />
    </IllustrationShell>
  );
}

export function VoiceOverArtistIllustration(props: IllustrationProps) {
  const id = "voice-over-artist";

  return (
    <IllustrationShell id={id} {...props}>
      <Stars id={id} />
      <WindowCard id={id} x={50} y={43} width={156} height={100}>
        <path d="M72 102C82 76 93 126 104 96C114 69 126 125 137 95C146 73 158 113 168 88M168 88C174 76 179 83 184 96" stroke={`url(#${id}-primary)`} strokeWidth="4" strokeLinecap="round" />
        <rect x="72" y="121" width="95" height="7" rx="3.5" fill={PRIMARY} opacity="0.14" />
      </WindowCard>
      <g filter={`url(#${id}-shadow)`}>
        <rect x="112" y="114" width="36" height="68" rx="18" fill="#FFFFFF" stroke={PRIMARY} strokeWidth="3" />
        <path d="M124 127H136M124 139H136M124 151H136" stroke={PRIMARY} strokeWidth="2.5" strokeLinecap="round" opacity="0.34" />
        <path d="M130 182V202M111 202H149" stroke={PRIMARY} strokeWidth="3" strokeLinecap="round" />
      </g>
      <Person x={72} y={109} scale={0.74} variant="default" pose="speaking" />
      <path d="M84 135C70 121 70 101 84 87M174 135C188 121 188 101 174 87" stroke={SECONDARY} strokeWidth="3" strokeLinecap="round" opacity="0.32" />
      <path d="M64 133C47 113 48 91 65 73M194 133C211 113 210 91 193 73" stroke={ACCENT} strokeWidth="3" strokeLinecap="round" opacity="0.22" />
    </IllustrationShell>
  );
}

export const CATEGORY_ILLUSTRATIONS = {
  videoEditor: VideoEditorIllustration,
  videographer: VideographerIllustration,
  graphicDesigner: GraphicDesignerIllustration,
  webDeveloper: WebDeveloperIllustration,
  motionDesigner: MotionDesignerIllustration,
  droneOperator: DroneOperatorIllustration,
  contentWriter: ContentWriterIllustration,
  socialMediaMarketer: SocialMediaMarketerIllustration,
  voiceOverArtist: VoiceOverArtistIllustration,
};
