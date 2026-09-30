// 히어로 배경: 비단결처럼 흐르는 그라데이션 (WebGL 조각 셰이더). 화면 밖·다른 탭·영상 만드는 중에는 멈춤.

const VERT = `attribute vec2 p;void main(){gl_Position=vec4(p,0.0,1.0);}`;
const FRAG = `precision mediump float;
uniform vec2 r;uniform float t;uniform vec2 m;
uniform vec3 c1;uniform vec3 c2;uniform vec3 c3;uniform vec3 bg;
void main(){
  vec2 uv=gl_FragCoord.xy/r;
  vec2 p=(gl_FragCoord.xy-0.5*r)/r.y;
  p+=(m-0.5)*0.06;
  float tt=t*0.11;
  vec2 q=p;
  for(int i=1;i<5;i++){
    float fi=float(i);
    q.x+=0.34/fi*sin(fi*2.0*q.y+tt*1.3+0.5*fi);
    q.y+=0.24/fi*cos(fi*1.6*q.x-tt*1.05+0.8*fi);
  }
  float band=sin(q.x*3.0+q.y*1.5+tt*2.0);
  vec3 col=mix(c1,c2,smoothstep(-0.9,0.9,band));
  float w2=0.5+0.5*sin(q.y*2.2-q.x*0.9-tt*1.6);
  col=mix(col,c3,w2*0.6);
  float sheen=pow(0.5+0.5*sin(q.x*3.0+q.y*1.5+tt*2.0+0.7),16.0);
  col+=sheen*0.16;
  float fold=pow(0.5+0.5*sin(q.x*3.0+q.y*1.5+tt*2.0-0.9),10.0);
  col-=fold*0.05;
  float vig=smoothstep(1.35,0.15,length(p*vec2(0.72,1.05)));
  col=mix(bg,col,0.25+0.75*vig);
  col=mix(col,bg,smoothstep(0.35,0.0,uv.y)*0.85);
  gl_FragColor=vec4(col,1.0);
}`;

function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
  if (!m) return [0.5, 0.5, 0.5];
  return [parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255];
}

export interface Silk {
  refreshColors(): void;
  setPaused(p: boolean): void;
}

export function initSilk(canvas: HTMLCanvasElement): Silk | null {
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, premultipliedAlpha: false, powerPreference: 'low-power' });
  if (!gl) {
    canvas.hidden = true;
    return null;
  }
  const compile = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return s;
  };
  const prog = gl.createProgram()!;
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    canvas.hidden = true;
    return null;
  }
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const u = (n: string) => gl.getUniformLocation(prog, n);
  const uR = u('r');
  const uT = u('t');
  const uM = u('m');
  const colors = ['c1', 'c2', 'c3', 'bg'].map(u);

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let visible = true;
  let paused = false;
  let raf = 0;
  let last = 0;
  let time = 7;
  let mx = 0.5;
  let my = 0.5;
  let tx = 0.5;
  let ty = 0.5;

  const resize = () => {
    // 부드러운 그라데이션이라 절반 해상도로 충분 (GPU 부담 줄임)
    const scale = Math.min(1, window.devicePixelRatio || 1) * 0.5;
    const w = Math.max(2, Math.round(canvas.clientWidth * scale));
    const h = Math.max(2, Math.round(canvas.clientHeight * scale));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
  };
  const draw = () => {
    resize();
    gl.uniform2f(uR, canvas.width, canvas.height);
    gl.uniform1f(uT, time);
    gl.uniform2f(uM, mx, my);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };
  const loop = (now: number) => {
    raf = 0;
    const dt = Math.min(0.05, (now - last) / 1000 || 0);
    last = now;
    time += dt;
    mx += (tx - mx) * 0.04;
    my += (ty - my) * 0.04;
    draw();
    schedule();
  };
  const schedule = () => {
    if (raf || reduced || paused || !visible || document.hidden) return;
    raf = requestAnimationFrame(loop);
  };
  const refreshColors = () => {
    const cs = getComputedStyle(document.documentElement);
    ['--silk-1', '--silk-2', '--silk-3', '--bg'].forEach((name, i) => {
      const [r, g, b] = hexToRgb(cs.getPropertyValue(name));
      gl.uniform3f(colors[i], r, g, b);
    });
    draw();
  };
  new IntersectionObserver((e) => {
    visible = e.some((x) => x.isIntersecting);
    last = performance.now();
    schedule();
  }).observe(canvas);
  document.addEventListener('visibilitychange', () => {
    last = performance.now();
    schedule();
  });
  window.addEventListener('resize', () => draw());
  window.addEventListener(
    'pointermove',
    (e) => {
      tx = e.clientX / innerWidth;
      ty = 1 - e.clientY / innerHeight;
    },
    { passive: true },
  );
  refreshColors();
  schedule();
  return {
    refreshColors,
    setPaused(p: boolean) {
      paused = p;
      last = performance.now();
      schedule();
    },
  };
}
