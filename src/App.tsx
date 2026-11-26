import { useState } from "react";
import { MeadowCanvas } from "./components/MeadowCanvas";
import { MeadowTheme } from "./scene/palette";
import { GalleryCardData, GalleryItem3D } from "./components/GalleryItem3D";

const GALLERY_ITEMS: GalleryCardData[] = [
  {
    id: 1,
    title: "Изумрудный кристалл луга",
    subtitle: "Гранёная минеральная призма утренней росы",
    modelType: "crystal-spire",
    color: "#6ba368",
    accent: "#d9f2b4",
  },
  {
    id: 2,
    title: "Сфера тёплого рассвета",
    subtitle: "Геодезический шар золотого горизонта",
    modelType: "sun-orb",
    color: "#d99b52",
    accent: "#fff1c9",
  },
  {
    id: 3,
    title: "Мшистое кольцо тишины",
    subtitle: "Плавная тороидальная форма лесной поляны",
    modelType: "moss-torus",
    color: "#4f7c54",
    accent: "#bfe3b4",
  },
  {
    id: 4,
    title: "Капля утренней росы",
    subtitle: "Двадцатигранник чистого горного воздуха",
    modelType: "dew-icosahedron",
    color: "#6ea8b5",
    accent: "#daf6ff",
  },
  {
    id: 5,
    title: "Альпийский пик",
    subtitle: "Силуэт далекой вершины в дымке",
    modelType: "alpine-pyramid",
    color: "#5d7a64",
    accent: "#d4e8d8",
  },
  {
    id: 6,
    title: "Поток весеннего ветра",
    subtitle: "Бесконечный узел движения над травами",
    modelType: "wind-knot",
    color: "#88ab75",
    accent: "#eef8d8",
  },
  {
    id: 7,
    title: "Орбита северного сияния",
    subtitle: "Светящееся кольцо и ядро ночного неба",
    modelType: "aurora-ring",
    color: "#557996",
    accent: "#b8e4ff",
  },
  {
    id: 8,
    title: "Монолит старого холма",
    subtitle: "Каменный ориентир на границе долины",
    modelType: "stone-monolith",
    color: "#737a6c",
    accent: "#e2e6dc",
  },
  {
    id: 9,
    title: "Цветок горного лотоса",
    subtitle: "Симметричный октаэдр цветущего склона",
    modelType: "lotus-octahedron",
    color: "#b87d95",
    accent: "#ffe0ec",
  },
  {
    id: 10,
    title: "Жемчужина тумана",
    subtitle: "Мягкая сфера вечерней прохлады",
    modelType: "mist-sphere",
    color: "#7a9488",
    accent: "#e5f5ee",
  },
];

export default function App() {
  const [theme, setTheme] = useState<MeadowTheme>("meadow");
  const [page, setPage] = useState<"hero" | "gallery">("hero");
  const [infoOpen, setInfoOpen] = useState(false);

  const isDark = theme === "moonlit";

  return (
    <main
      style={{
        position: "relative",
        width: "100%",
        minHeight: "100vh",
        overflowX: "hidden",
      }}
    >
      {/* Фоновая 3D-сцена луга */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          width: "100vw",
          height: "100vh",
          zIndex: 0,
        }}
      >
        <MeadowCanvas
          preset={theme}
          seed={42}
          ridgeCount={6}
          botanicalCount={22}
          interactive
          scrollParallax
        />
      </div>

      {/* Верхняя панель навигации */}
      <div
        style={{
          position: "relative",
          zIndex: 2,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "clamp(20px, 4vw, 44px)",
        }}
      >
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            onClick={() => setPage("hero")}
            style={{
              background: "none",
              border: "none",
              padding: 0,
              cursor: "pointer",
              fontWeight: 700,
              fontSize: "15px",
              letterSpacing: "0.06em",
              color: isDark ? "#eef0e8" : "#11140d",
            }}
          >
            TIFI MEADOW
          </button>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              flexWrap: "wrap",
            }}
          >
            {(["meadow", "golden", "moonlit"] as MeadowTheme[]).map((mode) => {
              const active = theme === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setTheme(mode)}
                  style={{
                    padding: "8px 14px",
                    borderRadius: "999px",
                    border: "1px solid rgba(255, 255, 255, 0.28)",
                    cursor: "pointer",
                    fontSize: "13px",
                    background: active ? "#ffffff" : "rgba(17, 20, 13, 0.55)",
                    color: active ? "#11140d" : "#eef1e6",
                    backdropFilter: "blur(8px)",
                  }}
                >
                  {mode}
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => setInfoOpen(true)}
              style={{
                padding: "8px 16px",
                borderRadius: "999px",
                border: "1px solid rgba(255, 255, 255, 0.45)",
                cursor: "pointer",
                fontSize: "13px",
                fontWeight: 600,
                background: "rgba(17, 20, 13, 0.78)",
                color: "#ffffff",
                backdropFilter: "blur(8px)",
              }}
            >
              Информация
            </button>
          </div>
        </header>

        {/* ЭКРАН 1: Главная страница */}
        {page === "hero" ? (
          <section
            style={{
              maxWidth: "700px",
              margin: "auto 0",
            }}
          >
            <h1
              style={{
                margin: 0,
                fontSize: "clamp(38px, 6.2vw, 84px)",
                lineHeight: 1.03,
                letterSpacing: "-0.04em",
                fontWeight: 500,
                color: isDark ? "#eef0e8" : "#11140d",
              }}
            >
              Тихий рассвет над{" "}
              <em
                style={{
                  fontFamily: "Georgia, serif",
                  fontStyle: "italic",
                  fontWeight: 400,
                }}
              >
                зелёными гребнями
              </em>
            </h1>

            <p
              style={{
                marginTop: "16px",
                maxWidth: "46ch",
                fontSize: "15px",
                lineHeight: 1.55,
                color: isDark ? "#c8d2c5" : "#2d3527",
              }}
            >
              Интерактивная 3D-сцена на Three.js с мягким рассеянным светом, дымкой и
              плавным откликом на движение.
            </p>

            <div style={{ marginTop: "28px", display: "flex", gap: "12px", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => {
                  setPage("gallery");
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                style={{
                  padding: "14px 28px",
                  borderRadius: "999px",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "15px",
                  fontWeight: 600,
                  background: isDark ? "#eef1e6" : "#11140d",
                  color: isDark ? "#11140d" : "#eef1e6",
                  boxShadow: "0 10px 28px rgba(0, 0, 0, 0.22)",
                }}
              >
                Продолжить →
              </button>
            </div>
          </section>
        ) : (
          /* ЭКРАН 2: Вторая страница с 10 3D-картинками */
          <section
            style={{
              width: "100%",
              maxWidth: "1240px",
              margin: "28px auto",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "16px",
                flexWrap: "wrap",
                marginBottom: "24px",
              }}
            >
              <div>
                <h2
                  style={{
                    margin: 0,
                    fontSize: "clamp(26px, 4vw, 42px)",
                    fontWeight: 500,
                    letterSpacing: "-0.03em",
                    color: isDark ? "#eef0e8" : "#11140d",
                  }}
                >
                  Коллекция 3D-образов
                </h2>
                <p
                  style={{
                    margin: "6px 0 0",
                    fontSize: "14px",
                    color: isDark ? "#c8d2c5" : "#2d3527",
                  }}
                >
                  10 интерактивных 3D-моделей — наведите курсор на карточку, чтобы повернуть фигуру
                </p>
              </div>

              <button
                type="button"
                onClick={() => setPage("hero")}
                style={{
                  padding: "10px 20px",
                  borderRadius: "999px",
                  border: "1px solid rgba(255, 255, 255, 0.35)",
                  cursor: "pointer",
                  fontSize: "13px",
                  fontWeight: 500,
                  background: "rgba(17, 20, 13, 0.65)",
                  color: "#eef1e6",
                  backdropFilter: "blur(8px)",
                }}
              >
                ← Назад на главную
              </button>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))",
                gap: "18px",
              }}
            >
              {GALLERY_ITEMS.map((item) => (
                <article
                  key={item.id}
                  style={{
                    borderRadius: "20px",
                    padding: "14px",
                    background: "rgba(17, 20, 13, 0.62)",
                    border: "1px solid rgba(255, 255, 255, 0.18)",
                    backdropFilter: "blur(14px)",
                    color: "#eef1e6",
                    display: "flex",
                    flexDirection: "column",
                    gap: "12px",
                    boxShadow: "0 12px 30px rgba(0, 0, 0, 0.18)",
                  }}
                >
                  <GalleryItem3D
                    modelType={item.modelType}
                    color={item.color}
                    accent={item.accent}
                  />

                  <div>
                    <div
                      style={{
                        fontSize: "11px",
                        opacity: 0.65,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                      }}
                    >
                      3D-объект #{item.id}
                    </div>
                    <h3
                      style={{
                        margin: "4px 0",
                        fontSize: "16px",
                        fontWeight: 600,
                        color: "#ffffff",
                      }}
                    >
                      {item.title}
                    </h3>
                    <p
                      style={{
                        margin: 0,
                        fontSize: "13px",
                        lineHeight: 1.4,
                        color: "#cfd7c9",
                      }}
                    >
                      {item.subtitle}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        <footer
          style={{
            marginTop: "24px",
            fontSize: "13px",
            color: "#eef1e6",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          <span>Tifi Meadow 3D · WebGL &amp; Three.js</span>
          <button
            type="button"
            onClick={() => setInfoOpen(true)}
            style={{
              background: "none",
              border: "none",
              padding: 0,
              color: "#eef1e6",
              textDecoration: "underline",
              cursor: "pointer",
              fontSize: "13px",
            }}
          >
            О создателе сайта
          </button>
        </footer>
      </div>

      {/* Модальное окно «Информация» */}
      {infoOpen && (
        <div
          onClick={() => setInfoOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 20,
            background: "rgba(8, 11, 7, 0.68)",
            backdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: "440px",
              borderRadius: "24px",
              padding: "28px",
              background: "#161b12",
              border: "1px solid rgba(255, 255, 255, 0.2)",
              color: "#eef1e6",
              boxShadow: "0 24px 60px rgba(0, 0, 0, 0.45)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "14px",
              }}
            >
              <h2 style={{ margin: 0, fontSize: "22px", fontWeight: 600 }}>
                Информация о сайте
              </h2>
              <button
                type="button"
                onClick={() => setInfoOpen(false)}
                aria-label="Закрыть"
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "50%",
                  border: "1px solid rgba(255,255,255,0.2)",
                  background: "rgba(255,255,255,0.08)",
                  color: "#fff",
                  cursor: "pointer",
                  fontSize: "16px",
                }}
              >
                ✕
              </button>
            </div>

            <p style={{ margin: "0 0 16px", fontSize: "15px", lineHeight: 1.6, color: "#d6ded0" }}>
              Создал сайт <strong>Tifi</strong>.
            </p>

            <a
              href="https://tifilew.github.io/Portfolio/"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-block",
                padding: "12px 20px",
                borderRadius: "999px",
                background: "#eef1e6",
                color: "#11140d",
                fontWeight: 600,
                fontSize: "14px",
                textDecoration: "none",
              }}
            >
              Открыть портфолио Tifi ↗
            </a>
          </div>
        </div>
      )}
    </main>
  );
}