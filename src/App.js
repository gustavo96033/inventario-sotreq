import React, { useEffect, useMemo, useRef, useState } from "react";

const STORAGE_KEYS = {
  materials: "inventario_materials_v6",
  inventories: "inventario_inventories_v6",
  currentInventory: "inventario_current_v6",
  auth: "inventario_auth_v6",
};

const CAT_YELLOW = "#f2c200";
const CAT_BLACK = "#111111";

const CSV_HEADERS_EXAMPLE =
  "PN;DESCRIÇÃO;LOCALIZAÇÃO;FOTO;OBSERVAÇÃO;STATUS;QUANTIDADE";

const demoMaterials = [];

const ACCESS_CONFIG = {
  inventario: [
    {
      matricula: "401711",
      senha: "Si91077463@",
      nome: "Gustavo",
    },
    {
      matricula: "2222",
      senha: "2222",
      nome: "Líder de equipe",
    },
  ],
  materiais: [
    {
      matricula: "401668",
      senha: "Ad@301769x",
      nome: "Alaysson",
    },
    {
      matricula: "2222",
      senha: "2222",
      nome: "Líder de equipe",
    },
    {
      matricula: "3333",
      senha: "3333",
      nome: "Auxiliar 1",
    },
    {
      matricula: "4444",
      senha: "4444",
      nome: "Auxiliar 2",
    },
  ],
};

function readStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error("Erro ao salvar no localStorage:", error);
  }
}

function normalizeHeader(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function extractQuantityFromObservation(text) {
  const raw = String(text || "");
  const match = raw.match(/\d+/);
  return match ? Number(match[0]) : 0;
}

function parseCsvLine(line) {
  const delimiter = line.includes(";") ? ";" : ",";
  const result = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

function parseCsvText(text) {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) return [];

  const headers = parseCsvLine(lines[0]).map((header) =>
    normalizeHeader(header)
  );

  const rows = lines.slice(1);

  return rows
    .map((line) => {
      const values = parseCsvLine(line);
      const row = {};

      headers.forEach((header, index) => {
        row[header] = values[index] ?? "";
      });

      const pn = String(row.pn || "").trim();
      const descricao = String(row.descricao || "").trim();
      const localizacao = String(row.localizacao || "").trim();
      const observacao = String(row.observacao || "").trim();
      const status = String(row.status || "IDENTIFICADO").trim();

      const quantidade =
        row.quantidade !== undefined && String(row.quantidade).trim() !== ""
          ? Number(row.quantidade || 0)
          : extractQuantityFromObservation(observacao);

      return {
        pn,
        descricao,
        localizacao,
        quantidade,
        observacao,
        status,
        foto: "",
        atualizadoEm: new Date().toISOString(),
      };
    })
    .filter((item) => item.pn && item.descricao);
}

function formatDateTime(value) {
  try {
    return new Date(value).toLocaleString("pt-BR");
  } catch {
    return value;
  }
}

function statusStyle(status) {
  const normalized = String(status || "").toUpperCase();

  if (normalized.includes("SEM LOCA")) {
    return { background: "#fee2e2", color: "#991b1b" };
  }

  if (normalized.includes("SEM FOTO")) {
    return { background: "#fef3c7", color: "#92400e" };
  }

  if (normalized.includes("IDENTIFICADO") || normalized.includes("COMPLETO")) {
    return { background: "#dcfce7", color: "#166534" };
  }

  return { background: "#e5e7eb", color: "#374151" };
}

function baseButtonStyle(kind = "primary") {
  if (kind === "primary") {
    return {
      background: CAT_YELLOW,
      color: CAT_BLACK,
      border: `1px solid ${CAT_YELLOW}`,
    };
  }

  if (kind === "danger") {
    return {
      background: "#dc2626",
      color: "white",
      border: "1px solid #dc2626",
    };
  }

  if (kind === "success") {
    return {
      background: "#16a34a",
      color: "white",
      border: "1px solid #16a34a",
    };
  }

  return {
    background: "white",
    color: CAT_BLACK,
    border: "1px solid #d1d5db",
  };
}

function ActionButton({
  children,
  onClick,
  type = "button",
  kind = "primary",
  fullWidth = false,
  disabled = false,
}) {
  return (
    <button
      type={type}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      style={{
        ...baseButtonStyle(kind),
        width: fullWidth ? "100%" : "auto",
        borderRadius: 16,
        padding: "12px 16px",
        fontWeight: 700,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {children}
    </button>
  );
}

function Panel({ title, children, right }) {
  return (
    <div
      style={{
        background: "white",
        borderRadius: 24,
        padding: 20,
        boxShadow: "0 8px 30px rgba(0,0,0,0.08)",
        border: "1px solid #e5e7eb",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          marginBottom: 16,
          flexWrap: "wrap",
        }}
      >
        <h2 style={{ margin: 0, fontSize: 22 }}>{title}</h2>
        {right}
      </div>
      {children}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <label style={{ fontSize: 14, fontWeight: 700, color: "#374151" }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function TextInput(props) {
  return (
    <input
      {...props}
      style={{
        width: "100%",
        minHeight: 46,
        borderRadius: 16,
        border: "1px solid #d1d5db",
        padding: "12px 14px",
        fontSize: 16,
        outline: "none",
        ...props.style,
      }}
    />
  );
}

function TextArea(props) {
  return (
    <textarea
      {...props}
      style={{
        width: "100%",
        borderRadius: 16,
        border: "1px solid #d1d5db",
        padding: "12px 14px",
        fontSize: 15,
        outline: "none",
        resize: "vertical",
        ...props.style,
      }}
    />
  );
}

function InventoryPhotoInput({ label, foto, onChange }) {
  const inputRef = useRef(null);

  function handleFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => onChange(reader.result);
    reader.readAsDataURL(file);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: "#374151" }}>
        {label}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFile}
        style={{ display: "none" }}
      />

      <div
        style={{
          border: "1px dashed #9ca3af",
          borderRadius: 18,
          background: "#f9fafb",
          minHeight: 180,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        {foto ? (
          <img
            src={foto}
            alt="Peça"
            style={{ width: "100%", height: 220, objectFit: "cover" }}
          />
        ) : (
          <div style={{ textAlign: "center", color: "#6b7280", padding: 20 }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>📷</div>
            <div>Sem foto</div>
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <ActionButton kind="primary" onClick={() => inputRef.current?.click()}>
          📷 Tirar / escolher foto
        </ActionButton>
        {foto ? (
          <ActionButton kind="secondary" onClick={() => onChange("")}>
            Remover foto
          </ActionButton>
        ) : null}
      </div>
    </div>
  );
}

function InventoryItemRow({ item, onChange, onRemove }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(12, minmax(0, 1fr))",
        gap: 12,
        border: "1px solid #e5e7eb",
        borderRadius: 20,
        padding: 14,
        background: "#fff",
      }}
    >
      <div style={{ gridColumn: "span 3" }}>
        <Field label="PN">
          <TextInput
            value={item.pn}
            onChange={(e) => onChange({ ...item, pn: e.target.value })}
            placeholder="Digite o PN"
          />
        </Field>
      </div>

      <div style={{ gridColumn: "span 4" }}>
        <Field label="Descrição">
          <TextInput
            value={item.descricao}
            onChange={(e) => onChange({ ...item, descricao: e.target.value })}
            placeholder="Descrição"
          />
        </Field>
      </div>

      <div style={{ gridColumn: "span 2" }}>
        <Field label="Qtd. contada">
          <TextInput
            type="number"
            value={item.quantidadeContada}
            onChange={(e) =>
              onChange({ ...item, quantidadeContada: e.target.value })
            }
            placeholder="0"
          />
        </Field>
      </div>

      <div style={{ gridColumn: "span 2" }}>
        <Field label="Localização">
          <TextInput
            value={item.localizacao}
            onChange={(e) => onChange({ ...item, localizacao: e.target.value })}
            placeholder="01.02.03.04"
          />
        </Field>
      </div>

      <div style={{ gridColumn: "span 1", display: "flex", alignItems: "end" }}>
        <ActionButton kind="danger" fullWidth onClick={onRemove}>
          Excluir
        </ActionButton>
      </div>

      <div style={{ gridColumn: "span 8" }}>
        <Field label="Observação">
          <TextArea
            value={item.observacao}
            onChange={(e) => onChange({ ...item, observacao: e.target.value })}
            rows={2}
            placeholder="Observações da contagem"
          />
        </Field>
      </div>

      <div style={{ gridColumn: "span 4" }}>
        <InventoryPhotoInput
          label="Foto da peça na contagem"
          foto={item.foto || ""}
          onChange={(foto) => onChange({ ...item, foto })}
        />
      </div>
    </div>
  );
}

function MaterialListItem({ item, onEdit, onDelete }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "72px 1fr auto",
        gap: 12,
        border: "1px solid #e5e7eb",
        borderRadius: 20,
        padding: 12,
        alignItems: "center",
        background: "white",
      }}
    >
      <div
        style={{
          width: 72,
          height: 72,
          borderRadius: 16,
          overflow: "hidden",
          background: "#f3f4f6",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {item.foto ? (
          <img
            src={item.foto}
            alt={item.descricao}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <span style={{ color: "#6b7280" }}>📦</span>
        )}
      </div>

      <div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <strong>{item.descricao}</strong>
          <span
            style={{
              ...statusStyle(item.status),
              padding: "4px 10px",
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            {item.status}
          </span>
        </div>
        <div style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>
          PN: {item.pn}
        </div>
        <div style={{ fontSize: 14, color: "#6b7280", marginTop: 2 }}>
          Localização: {item.localizacao || "Não informada"}
        </div>
        <div style={{ fontSize: 14, color: "#6b7280", marginTop: 2 }}>
          Quantidade: {item.quantidade ?? 0}
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <ActionButton kind="secondary" onClick={() => onEdit(item)}>
          Editar
        </ActionButton>
        <ActionButton kind="danger" onClick={() => onDelete(item.pn)}>
          Excluir
        </ActionButton>
      </div>
    </div>
  );
}

function LoginGate({
  title,
  subtitle,
  onLogin,
  loginForm,
  setLoginForm,
  errorMessage,
}) {
  return (
    <Panel title={title}>
      <div
        style={{
          maxWidth: 440,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <div
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 24,
            padding: 20,
            background: "#f8fafc",
          }}
        >
          <div style={{ fontWeight: 800, fontSize: 20 }}>{subtitle}</div>
          <div style={{ color: "#6b7280", marginTop: 6 }}>
            Informe sua matrícula e senha para continuar.
          </div>
        </div>

        <Field label="Matrícula">
          <TextInput
            value={loginForm.matricula}
            onChange={(e) =>
              setLoginForm((prev) => ({ ...prev, matricula: e.target.value }))
            }
            placeholder="Digite sua matrícula"
          />
        </Field>

        <Field label="Senha">
          <TextInput
            type="password"
            value={loginForm.senha}
            onChange={(e) =>
              setLoginForm((prev) => ({ ...prev, senha: e.target.value }))
            }
            placeholder="Digite sua senha"
            onKeyDown={(e) => {
              if (e.key === "Enter") onLogin();
            }}
          />
        </Field>

        {errorMessage ? (
          <div
            style={{
              background: "#fee2e2",
              color: "#991b1b",
              border: "1px solid #fecaca",
              padding: 12,
              borderRadius: 16,
              fontWeight: 700,
            }}
          >
            {errorMessage}
          </div>
        ) : null}

        <ActionButton fullWidth onClick={onLogin}>
          Entrar
        </ActionButton>
      </div>
    </Panel>
  );
}

function LandingScreen({ onEnter }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top, rgba(242,194,0,0.16) 0%, rgba(242,194,0,0.05) 18%, #141414 42%, #090909 100%)",
        color: "white",
        fontFamily: "Arial, sans-serif",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(135deg, rgba(255,255,255,0.03) 0%, transparent 22%, transparent 78%, rgba(255,255,255,0.02) 100%)",
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          position: "absolute",
          top: -120,
          right: -120,
          width: 340,
          height: 340,
          borderRadius: "50%",
          background: "rgba(242,194,0,0.08)",
          filter: "blur(30px)",
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          position: "absolute",
          bottom: -140,
          left: -100,
          width: 320,
          height: 320,
          borderRadius: "50%",
          background: "rgba(242,194,0,0.07)",
          filter: "blur(30px)",
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          width: "100%",
          maxWidth: 1240,
          display: "grid",
          gridTemplateColumns: "1.08fr 0.92fr",
          gap: 30,
          alignItems: "center",
          position: "relative",
          zIndex: 1,
        }}
      >
        <div>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              background: "rgba(242,194,0,0.12)",
              color: "#f2c200",
              border: "1px solid rgba(242,194,0,0.35)",
              borderRadius: 999,
              padding: "10px 16px",
              fontWeight: 800,
              marginBottom: 22,
              boxShadow: "0 10px 30px rgba(242,194,0,0.08)",
            }}
          >
            SOTREQ CAT • USO INTERNO
          </div>

          <div
            style={{
              fontSize: 14,
              letterSpacing: 2.2,
              textTransform: "uppercase",
              color: "#9ca3af",
              fontWeight: 700,
              marginBottom: 12,
            }}
          >
            Plataforma de controle operacional
          </div>

          <h1
            style={{
              fontSize: 64,
              lineHeight: 0.98,
              margin: "0 0 18px",
              fontWeight: 900,
              letterSpacing: -1.8,
            }}
          >
            Inventário
            <br />
            de Materiais
          </h1>

          <div
            style={{
              fontSize: 20,
              color: "#d1d5db",
              maxWidth: 700,
              lineHeight: 1.65,
              marginBottom: 28,
            }}
          >
            Sistema interno para pesquisa de peças, cadastro de materiais,
            consulta por PN e acompanhamento completo dos inventários mensais da
            equipe.
          </div>

          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            <button
              onClick={onEnter}
              style={{
                background: "linear-gradient(135deg, #f2c200 0%, #ffd84d 100%)",
                color: "#111111",
                border: "1px solid #f2c200",
                borderRadius: 20,
                padding: "17px 26px",
                fontSize: 16,
                fontWeight: 900,
                cursor: "pointer",
                boxShadow: "0 14px 34px rgba(242,194,0,0.22)",
              }}
            >
              Acessar Projeto Inventário
            </button>

            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "16px 18px",
                borderRadius: 20,
                border: "1px solid rgba(255,255,255,0.10)",
                color: "#d1d5db",
                background: "rgba(255,255,255,0.04)",
                fontWeight: 700,
              }}
            >
              Pesquisa • Cadastro • Inventário • Histórico
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: 14,
              marginTop: 32,
              maxWidth: 760,
            }}
          >
            <div
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 22,
                padding: 18,
              }}
            >
              <div style={{ fontSize: 12, color: "#9ca3af" }}>Controle</div>
              <div style={{ fontSize: 24, fontWeight: 900, marginTop: 6 }}>
                PN
              </div>
              <div style={{ marginTop: 8, color: "#d1d5db", lineHeight: 1.5 }}>
                Busca rápida por peça e localização.
              </div>
            </div>

            <div
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 22,
                padding: 18,
              }}
            >
              <div style={{ fontSize: 12, color: "#9ca3af" }}>Registro</div>
              <div style={{ fontSize: 24, fontWeight: 900, marginTop: 6 }}>
                CSV
              </div>
              <div style={{ marginTop: 8, color: "#d1d5db", lineHeight: 1.5 }}>
                Importação e exportação de materiais.
              </div>
            </div>

            <div
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 22,
                padding: 18,
              }}
            >
              <div style={{ fontSize: 12, color: "#9ca3af" }}>Histórico</div>
              <div style={{ fontSize: 24, fontWeight: 900, marginTop: 6 }}>
                24h
              </div>
              <div style={{ marginTop: 8, color: "#d1d5db", lineHeight: 1.5 }}>
                Inventários salvos e retomada rápida.
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            background: "linear-gradient(180deg, #1c1c1c 0%, #101010 100%)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 34,
            padding: 24,
            boxShadow: "0 22px 70px rgba(0,0,0,0.38)",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: -40,
              right: -30,
              width: 180,
              height: 180,
              borderRadius: "50%",
              background: "rgba(242,194,0,0.10)",
              filter: "blur(20px)",
            }}
          />

          <div
            style={{
              position: "relative",
              zIndex: 1,
              display: "grid",
              gap: 16,
            }}
          >
            <div
              style={{
                borderRadius: 26,
                padding: 20,
                background:
                  "linear-gradient(135deg, rgba(242,194,0,0.18) 0%, rgba(242,194,0,0.06) 100%)",
                border: "1px solid rgba(242,194,0,0.22)",
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  letterSpacing: 1.8,
                  textTransform: "uppercase",
                  color: "#f2c200",
                  fontWeight: 800,
                }}
              >
                Projeto interno
              </div>

              <div
                style={{
                  fontSize: 30,
                  fontWeight: 900,
                  marginTop: 8,
                  color: "#ffffff",
                }}
              >
                Inventário SOTREQ
              </div>

              <div
                style={{
                  marginTop: 10,
                  lineHeight: 1.65,
                  color: "#e5e7eb",
                  fontSize: 15,
                }}
              >
                Ambiente organizado para gestão de materiais, registro com foto,
                acompanhamento de contagens e histórico de inventários.
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                gap: 14,
              }}
            >
              <div
                style={{
                  background: "rgba(255,255,255,0.04)",
                  borderRadius: 22,
                  padding: 18,
                  border: "1px solid rgba(255,255,255,0.05)",
                }}
              >
                <div style={{ fontSize: 13, color: "#9ca3af" }}>Módulo</div>
                <div style={{ fontSize: 22, fontWeight: 800, marginTop: 6 }}>
                  Pesquisa
                </div>
                <div
                  style={{ color: "#d1d5db", marginTop: 8, lineHeight: 1.5 }}
                >
                  Consulta por PN, descrição e localização.
                </div>
              </div>

              <div
                style={{
                  background: "rgba(255,255,255,0.04)",
                  borderRadius: 22,
                  padding: 18,
                  border: "1px solid rgba(255,255,255,0.05)",
                }}
              >
                <div style={{ fontSize: 13, color: "#9ca3af" }}>Módulo</div>
                <div style={{ fontSize: 22, fontWeight: 800, marginTop: 6 }}>
                  Cadastro
                </div>
                <div
                  style={{ color: "#d1d5db", marginTop: 8, lineHeight: 1.5 }}
                >
                  Materiais com foto, status e quantidade.
                </div>
              </div>

              <div
                style={{
                  background: "rgba(255,255,255,0.04)",
                  borderRadius: 22,
                  padding: 18,
                  border: "1px solid rgba(255,255,255,0.05)",
                }}
              >
                <div style={{ fontSize: 13, color: "#9ca3af" }}>Módulo</div>
                <div style={{ fontSize: 22, fontWeight: 800, marginTop: 6 }}>
                  Inventário
                </div>
                <div
                  style={{ color: "#d1d5db", marginTop: 8, lineHeight: 1.5 }}
                >
                  Contagem manual e adição por pesquisa.
                </div>
              </div>

              <div
                style={{
                  background: "rgba(255,255,255,0.04)",
                  borderRadius: 22,
                  padding: 18,
                  border: "1px solid rgba(255,255,255,0.05)",
                }}
              >
                <div style={{ fontSize: 13, color: "#9ca3af" }}>Módulo</div>
                <div style={{ fontSize: 22, fontWeight: 800, marginTop: 6 }}>
                  Histórico
                </div>
                <div
                  style={{ color: "#d1d5db", marginTop: 8, lineHeight: 1.5 }}
                >
                  Reabertura e acompanhamento dos salvos.
                </div>
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 14,
              }}
            >
              <div
                style={{
                  borderRadius: 22,
                  padding: 18,
                  background: "#0f0f0f",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <div style={{ fontSize: 12, color: "#9ca3af" }}>
                  Segurança interna
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, marginTop: 6 }}>
                  Acesso por matrícula
                </div>
              </div>

              <div
                style={{
                  borderRadius: 22,
                  padding: 18,
                  background: "#0f0f0f",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <div style={{ fontSize: 12, color: "#9ca3af" }}>
                  Persistência
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, marginTop: 6 }}>
                  Dados salvos localmente
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [materials, setMaterials] = useState([]);
  const [inventories, setInventories] = useState([]);
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState("pesquisa");
  const [newInventoryName, setNewInventoryName] = useState("");
  const [currentInventory, setCurrentInventory] = useState(null);
  const [importMessage, setImportMessage] = useState("");
  const [enteredSite, setEnteredSite] = useState(false);
  const csvInputRef = useRef(null);

  const [authState, setAuthState] = useState({
    inventario: null,
    materiais: null,
  });

  const [inventarioLoginForm, setInventarioLoginForm] = useState({
    matricula: "",
    senha: "",
  });

  const [materiaisLoginForm, setMateriaisLoginForm] = useState({
    matricula: "",
    senha: "",
  });

  const [inventarioLoginError, setInventarioLoginError] = useState("");
  const [materiaisLoginError, setMateriaisLoginError] = useState("");

  const [newMaterial, setNewMaterial] = useState({
    pn: "",
    descricao: "",
    localizacao: "",
    quantidade: "",
    observacao: "",
    status: "IDENTIFICADO",
    foto: "",
  });

  useEffect(() => {
    const savedMaterials = readStorage(STORAGE_KEYS.materials, demoMaterials);
    const savedInventories = readStorage(STORAGE_KEYS.inventories, []);
    const savedCurrentInventory = readStorage(
      STORAGE_KEYS.currentInventory,
      null
    );
    const savedAuth = readStorage(STORAGE_KEYS.auth, {
      inventario: null,
      materiais: null,
    });

    setMaterials(savedMaterials);
    setInventories(savedInventories);
    setCurrentInventory(savedCurrentInventory);
    setAuthState(savedAuth);
  }, []);

  useEffect(() => {
    writeStorage(STORAGE_KEYS.materials, materials);
  }, [materials]);

  useEffect(() => {
    writeStorage(STORAGE_KEYS.inventories, inventories);
  }, [inventories]);

  useEffect(() => {
    writeStorage(STORAGE_KEYS.currentInventory, currentInventory);
  }, [currentInventory]);

  useEffect(() => {
    writeStorage(STORAGE_KEYS.auth, authState);
  }, [authState]);

  const filteredMaterials = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return materials;

    return materials.filter((item) => {
      const pn = String(item.pn || "").toLowerCase();
      const descricao = String(item.descricao || "").toLowerCase();
      const localizacao = String(item.localizacao || "").toLowerCase();

      return pn.includes(q) || descricao.includes(q) || localizacao.includes(q);
    });
  }, [materials, query]);

  const selectedMaterial = useMemo(() => {
    if (!query.trim()) return null;
    return filteredMaterials[0] || null;
  }, [filteredMaterials, query]);

  function authenticate(area, matricula, senha) {
    const list = ACCESS_CONFIG[area] || [];
    return (
      list.find(
        (user) =>
          String(user.matricula).trim() === String(matricula).trim() &&
          String(user.senha) === String(senha)
      ) || null
    );
  }

  function handleInventarioLogin() {
    const found = authenticate(
      "inventario",
      inventarioLoginForm.matricula,
      inventarioLoginForm.senha
    );

    if (!found) {
      setInventarioLoginError(
        "Matrícula ou senha inválida para a área de inventário."
      );
      return;
    }

    setInventarioLoginError("");
    setAuthState((prev) => ({
      ...prev,
      inventario: {
        matricula: found.matricula,
        nome: found.nome,
        loggedAt: new Date().toISOString(),
      },
    }));
    setInventarioLoginForm({ matricula: "", senha: "" });
  }

  function handleMateriaisLogin() {
    const found = authenticate(
      "materiais",
      materiaisLoginForm.matricula,
      materiaisLoginForm.senha
    );

    if (!found) {
      setMateriaisLoginError(
        "Matrícula ou senha inválida para a área de materiais."
      );
      return;
    }

    setMateriaisLoginError("");
    setAuthState((prev) => ({
      ...prev,
      materiais: {
        matricula: found.matricula,
        nome: found.nome,
        loggedAt: new Date().toISOString(),
      },
    }));
    setMateriaisLoginForm({ matricula: "", senha: "" });
  }

  function logoutArea(area) {
    setAuthState((prev) => ({
      ...prev,
      [area]: null,
    }));

    if (area === "inventario") {
      setInventarioLoginError("");
      setInventarioLoginForm({ matricula: "", senha: "" });
    }

    if (area === "materiais") {
      setMateriaisLoginError("");
      setMateriaisLoginForm({ matricula: "", senha: "" });
    }
  }

  function startNewInventory() {
    const name =
      newInventoryName.trim() ||
      `Inventário ${new Date().toLocaleDateString("pt-BR")}`;

    setCurrentInventory({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      nome: name,
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString(),
      criadoPor: authState.inventario?.nome || "Usuário",
      itens: [],
    });

    setActiveTab("inventario");
    setNewInventoryName("");
  }

  function saveCurrentInventory() {
    if (!currentInventory) return;

    const sanitized = {
      ...currentInventory,
      atualizadoEm: new Date().toISOString(),
    };

    setCurrentInventory(sanitized);

    setInventories((prev) => {
      const exists = prev.some((inv) => inv.id === sanitized.id);
      if (exists) {
        return prev.map((inv) => (inv.id === sanitized.id ? sanitized : inv));
      }
      return [sanitized, ...prev];
    });

    alert("Inventário salvo com sucesso.");
  }

  function addManualItemToInventory() {
    if (!currentInventory) return;

    setCurrentInventory((prev) => ({
      ...prev,
      atualizadoEm: new Date().toISOString(),
      itens: [
        ...prev.itens,
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          pn: "",
          descricao: "",
          quantidadeContada: "",
          localizacao: "",
          observacao: "",
          foto: "",
        },
      ],
    }));
  }

  function addSearchedItemToInventory() {
    if (!currentInventory || !selectedMaterial) return;

    setCurrentInventory((prev) => ({
      ...prev,
      atualizadoEm: new Date().toISOString(),
      itens: [
        ...prev.itens,
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          pn: selectedMaterial.pn,
          descricao: selectedMaterial.descricao,
          quantidadeContada: selectedMaterial.quantidade ?? "",
          localizacao: selectedMaterial.localizacao,
          observacao: selectedMaterial.observacao || "",
          foto: selectedMaterial.foto || "",
        },
      ],
    }));

    setActiveTab("inventario");
  }

  function updateInventoryItem(itemId, nextItem) {
    setCurrentInventory((prev) => ({
      ...prev,
      atualizadoEm: new Date().toISOString(),
      itens: prev.itens.map((item) => (item.id === itemId ? nextItem : item)),
    }));
  }

  function removeInventoryItem(itemId) {
    setCurrentInventory((prev) => ({
      ...prev,
      atualizadoEm: new Date().toISOString(),
      itens: prev.itens.filter((item) => item.id !== itemId),
    }));
  }

  function saveMaterial() {
    if (!newMaterial.pn.trim() || !newMaterial.descricao.trim()) {
      alert("Preencha pelo menos PN e descrição.");
      return;
    }

    const payload = {
      ...newMaterial,
      pn: newMaterial.pn.trim(),
      descricao: newMaterial.descricao.trim(),
      localizacao: newMaterial.localizacao.trim(),
      observacao: newMaterial.observacao.trim(),
      quantidade: Number(newMaterial.quantidade || 0),
      atualizadoEm: new Date().toISOString(),
    };

    setMaterials((prev) => {
      const exists = prev.some((item) => item.pn === payload.pn);
      if (exists) {
        return prev.map((item) => (item.pn === payload.pn ? payload : item));
      }
      return [payload, ...prev];
    });

    setNewMaterial({
      pn: "",
      descricao: "",
      localizacao: "",
      quantidade: "",
      observacao: "",
      status: "IDENTIFICADO",
      foto: "",
    });

    alert("Material salvo com sucesso.");
  }

  function handleEditMaterial(item) {
    setNewMaterial({
      pn: item.pn || "",
      descricao: item.descricao || "",
      localizacao: item.localizacao || "",
      quantidade: item.quantidade ?? "",
      observacao: item.observacao || "",
      status: item.status || "IDENTIFICADO",
      foto: item.foto || "",
    });

    setActiveTab("cadastro");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function deleteMaterial(pn) {
    if (!window.confirm(`Deseja excluir o material PN ${pn}?`)) return;
    setMaterials((prev) => prev.filter((item) => item.pn !== pn));
  }

  function handleImportCsv(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = () => {
      try {
        const imported = parseCsvText(String(reader.result || ""));

        if (!imported.length) {
          setImportMessage(
            "Nenhum material válido encontrado no CSV. Verifique os cabeçalhos e o separador."
          );
          return;
        }

        setMaterials((prev) => {
          const map = new Map(prev.map((item) => [item.pn, item]));
          imported.forEach((item) => {
            const existing = map.get(item.pn);
            map.set(item.pn, {
              ...existing,
              ...item,
              atualizadoEm: new Date().toISOString(),
            });
          });
          return Array.from(map.values());
        });

        setImportMessage(
          `${imported.length} materiais importados com sucesso.`
        );
      } catch (error) {
        console.error(error);
        setImportMessage(
          "Erro ao importar CSV. Verifique as colunas e o formato do arquivo."
        );
      } finally {
        event.target.value = "";
      }
    };

    reader.readAsText(file, "utf-8");
  }

  function exportMaterialsCsv() {
    if (!materials.length) {
      alert("Não há materiais para exportar.");
      return;
    }

    const lines = [CSV_HEADERS_EXAMPLE];

    materials.forEach((item) => {
      const line = [
        item.pn,
        item.descricao,
        item.localizacao,
        "",
        item.observacao,
        item.status,
        item.quantidade ?? 0,
      ]
        .map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`)
        .join(";");

      lines.push(line);
    });

    const blob = new Blob([lines.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "materiais_inventario.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  function exportCurrentInventoryCsv() {
    if (!currentInventory || !currentInventory.itens.length) {
      alert("Não há itens no inventário atual para exportar.");
      return;
    }

    const headers =
      "PN;DESCRIÇÃO;QTD_CONTADA;LOCALIZAÇÃO;OBSERVAÇÃO;NOME_INVENTÁRIO";

    const lines = [headers];

    currentInventory.itens.forEach((item) => {
      const line = [
        item.pn,
        item.descricao,
        item.quantidadeContada,
        item.localizacao,
        item.observacao,
        currentInventory.nome,
      ]
        .map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`)
        .join(";");

      lines.push(line);
    });

    const blob = new Blob([lines.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${currentInventory.nome}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function loadInventory(inv) {
    setCurrentInventory(inv);
    setActiveTab("inventario");
  }

  function createAnotherInventory() {
    if (
      currentInventory?.itens?.length &&
      !window.confirm(
        "Deseja realmente abrir um novo inventário? O inventário atual continua salvo somente se você já tiver clicado em 'Salvar inventário'."
      )
    ) {
      return;
    }

    setCurrentInventory(null);
    setNewInventoryName("");
    setActiveTab("inventario");
  }

  function deleteInventory(id) {
    if (!window.confirm("Deseja excluir esse inventário?")) return;

    setInventories((prev) => prev.filter((inv) => inv.id !== id));

    if (currentInventory?.id === id) {
      setCurrentInventory(null);
    }
  }

  const pageStyle = {
    minHeight: "100vh",
    background: "linear-gradient(180deg, #f8fafc 0%, #eef2f7 100%)",
    color: CAT_BLACK,
    fontFamily: "Arial, sans-serif",
  };

  const topCardStyle = {
    background: CAT_BLACK,
    color: "white",
    borderRadius: 28,
    padding: 24,
    boxShadow: "0 18px 40px rgba(0,0,0,0.18)",
  };

  const tabButton = (tab) => ({
    padding: "12px 16px",
    borderRadius: 16,
    border: activeTab === tab ? `2px solid ${CAT_YELLOW}` : "1px solid #d1d5db",
    background: activeTab === tab ? "#fff8d6" : "white",
    color: CAT_BLACK,
    fontWeight: 700,
    cursor: "pointer",
    minWidth: 140,
  });

  const canAccessInventario = !!authState.inventario;
  const canAccessMateriais = !!authState.materiais;

  if (!enteredSite) {
    return <LandingScreen onEnter={() => setEnteredSite(true)} />;
  }

  return (
    <div style={pageStyle}>
      <div style={{ maxWidth: 1320, margin: "0 auto", padding: 20 }}>
        <div style={topCardStyle}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 16,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <div>
              <div
                style={{ fontSize: 34, fontWeight: 800, letterSpacing: -0.5 }}
              >
                Inventário
              </div>
              <div style={{ marginTop: 6, color: "#d1d5db" }}>
                Pesquisa de peças, consulta por PN, cadastro de materiais e
                controle de inventários mensais.
              </div>
            </div>

            <div
              style={{
                display: "flex",
                gap: 12,
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <div
                style={{
                  background: CAT_YELLOW,
                  color: CAT_BLACK,
                  padding: "10px 14px",
                  borderRadius: 18,
                  fontWeight: 800,
                  letterSpacing: 0.3,
                }}
              >
                SOTREQ CAT
              </div>

              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <div
                  style={{
                    background: "rgba(255,255,255,0.1)",
                    borderRadius: 20,
                    padding: "12px 16px",
                  }}
                >
                  <div style={{ fontSize: 12, color: "#d1d5db" }}>
                    Materiais
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 800 }}>
                    {materials.length}
                  </div>
                </div>

                <div
                  style={{
                    background: "rgba(255,255,255,0.1)",
                    borderRadius: 20,
                    padding: "12px 16px",
                  }}
                >
                  <div style={{ fontSize: 12, color: "#d1d5db" }}>
                    Inventários
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 800 }}>
                    {inventories.length}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
            marginTop: 20,
            marginBottom: 20,
          }}
        >
          <button
            style={tabButton("pesquisa")}
            onClick={() => setActiveTab("pesquisa")}
          >
            Pesquisa
          </button>

          <button
            style={tabButton("inventario")}
            onClick={() => setActiveTab("inventario")}
          >
            Inventário
          </button>

          <button
            style={tabButton("historico")}
            onClick={() => setActiveTab("historico")}
          >
            Histórico
          </button>

          <button
            style={tabButton("cadastro")}
            onClick={() => setActiveTab("cadastro")}
          >
            Materiais cadastrados
          </button>
        </div>

        {activeTab === "pesquisa" && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.15fr 0.85fr",
              gap: 20,
            }}
          >
            <Panel title="Buscar material por PN">
              <div
                style={{ display: "flex", flexDirection: "column", gap: 12 }}
              >
                <Field label="Digite o PN, descrição ou localização">
                  <TextInput
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Ex.: 3162826.000"
                    style={{ minHeight: 52 }}
                  />
                </Field>

                {selectedMaterial ? (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "260px 1fr",
                      gap: 16,
                    }}
                  >
                    <div
                      style={{
                        borderRadius: 24,
                        border: "1px solid #e5e7eb",
                        background: "#f8fafc",
                        overflow: "hidden",
                        minHeight: 260,
                      }}
                    >
                      {selectedMaterial.foto ? (
                        <img
                          src={selectedMaterial.foto}
                          alt={selectedMaterial.descricao}
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            minHeight: 260,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "#6b7280",
                            textAlign: "center",
                            padding: 20,
                          }}
                        >
                          Sem foto cadastrada
                        </div>
                      )}
                    </div>

                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 14,
                      }}
                    >
                      <div
                        style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
                      >
                        <span
                          style={{
                            background: "#111827",
                            color: "white",
                            padding: "8px 12px",
                            borderRadius: 999,
                            fontWeight: 700,
                          }}
                        >
                          PN {selectedMaterial.pn}
                        </span>
                        <span
                          style={{
                            ...statusStyle(selectedMaterial.status),
                            padding: "8px 12px",
                            borderRadius: 999,
                            fontWeight: 700,
                          }}
                        >
                          {selectedMaterial.status}
                        </span>
                      </div>

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                          gap: 12,
                        }}
                      >
                        <div
                          style={{
                            border: "1px solid #e5e7eb",
                            borderRadius: 18,
                            padding: 14,
                          }}
                        >
                          <div style={{ fontSize: 12, color: "#6b7280" }}>
                            Descrição
                          </div>
                          <div style={{ fontWeight: 700, marginTop: 6 }}>
                            {selectedMaterial.descricao}
                          </div>
                        </div>

                        <div
                          style={{
                            border: "1px solid #e5e7eb",
                            borderRadius: 18,
                            padding: 14,
                          }}
                        >
                          <div style={{ fontSize: 12, color: "#6b7280" }}>
                            Localização
                          </div>
                          <div style={{ fontWeight: 700, marginTop: 6 }}>
                            {selectedMaterial.localizacao || "Não informada"}
                          </div>
                        </div>

                        <div
                          style={{
                            border: "1px solid #e5e7eb",
                            borderRadius: 18,
                            padding: 14,
                          }}
                        >
                          <div style={{ fontSize: 12, color: "#6b7280" }}>
                            Quantidade
                          </div>
                          <div style={{ fontWeight: 700, marginTop: 6 }}>
                            {selectedMaterial.quantidade ?? 0}
                          </div>
                        </div>

                        <div
                          style={{
                            border: "1px solid #e5e7eb",
                            borderRadius: 18,
                            padding: 14,
                          }}
                        >
                          <div style={{ fontSize: 12, color: "#6b7280" }}>
                            Observação
                          </div>
                          <div style={{ fontWeight: 700, marginTop: 6 }}>
                            {selectedMaterial.observacao || "Sem observações"}
                          </div>
                        </div>
                      </div>

                      <div
                        style={{ display: "flex", gap: 12, flexWrap: "wrap" }}
                      >
                        <ActionButton
                          onClick={addSearchedItemToInventory}
                          disabled={!currentInventory}
                        >
                          Adicionar ao inventário atual
                        </ActionButton>

                        <ActionButton
                          kind="secondary"
                          onClick={() => setActiveTab("inventario")}
                        >
                          Abrir tela de inventário
                        </ActionButton>
                      </div>

                      {!currentInventory ? (
                        <div
                          style={{
                            background: "#fff8d6",
                            border: "1px solid #f2c200",
                            borderRadius: 16,
                            padding: 12,
                            fontSize: 14,
                          }}
                        >
                          Crie ou abra um inventário primeiro para poder
                          adicionar itens por pesquisa.
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      border: "1px dashed #cbd5e1",
                      borderRadius: 24,
                      background: "#f8fafc",
                      padding: 40,
                      textAlign: "center",
                      color: "#64748b",
                    }}
                  >
                    Digite um PN para buscar o material.
                  </div>
                )}
              </div>
            </Panel>

            <Panel title="Resultados rápidos">
              <div
                style={{ display: "flex", flexDirection: "column", gap: 10 }}
              >
                {filteredMaterials.slice(0, 8).map((item) => (
                  <button
                    key={item.pn}
                    onClick={() => setQuery(item.pn)}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "64px 1fr",
                      gap: 12,
                      width: "100%",
                      textAlign: "left",
                      borderRadius: 20,
                      border: "1px solid #e5e7eb",
                      background: "white",
                      padding: 12,
                      cursor: "pointer",
                    }}
                  >
                    <div
                      style={{
                        borderRadius: 16,
                        overflow: "hidden",
                        background: "#f3f4f6",
                        width: 64,
                        height: 64,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {item.foto ? (
                        <img
                          src={item.foto}
                          alt={item.descricao}
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                          }}
                        />
                      ) : (
                        <span style={{ color: "#6b7280" }}>📦</span>
                      )}
                    </div>

                    <div>
                      <div style={{ fontWeight: 700 }}>{item.descricao}</div>
                      <div
                        style={{ fontSize: 14, color: "#6b7280", marginTop: 2 }}
                      >
                        PN: {item.pn}
                      </div>
                      <div
                        style={{ fontSize: 14, color: "#6b7280", marginTop: 2 }}
                      >
                        Loc.: {item.localizacao || "-"}
                      </div>
                    </div>
                  </button>
                ))}

                {!filteredMaterials.length && (
                  <div
                    style={{
                      border: "1px dashed #cbd5e1",
                      borderRadius: 20,
                      padding: 30,
                      textAlign: "center",
                      color: "#64748b",
                    }}
                  >
                    Nenhum material encontrado.
                  </div>
                )}
              </div>
            </Panel>
          </div>
        )}

        {activeTab === "inventario" && !canAccessInventario && (
          <LoginGate
            title="Área de Inventário"
            subtitle="Acesso restrito"
            onLogin={handleInventarioLogin}
            loginForm={inventarioLoginForm}
            setLoginForm={setInventarioLoginForm}
            errorMessage={inventarioLoginError}
          />
        )}

        {activeTab === "inventario" && canAccessInventario && (
          <Panel
            title="Controle de inventário"
            right={
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <div
                  style={{
                    background: "#f3f4f6",
                    borderRadius: 16,
                    padding: "10px 14px",
                    fontWeight: 700,
                  }}
                >
                  👤 {authState.inventario?.nome}
                </div>
                <ActionButton
                  kind="secondary"
                  onClick={() => logoutArea("inventario")}
                >
                  Sair
                </ActionButton>
              </div>
            }
          >
            {!currentInventory ? (
              <div
                style={{ display: "flex", flexDirection: "column", gap: 14 }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr auto",
                    gap: 12,
                  }}
                >
                  <TextInput
                    value={newInventoryName}
                    onChange={(e) => setNewInventoryName(e.target.value)}
                    placeholder="Ex.: Inventário Abril 2026"
                    style={{ minHeight: 52 }}
                  />
                  <ActionButton onClick={startNewInventory}>
                    Criar inventário
                  </ActionButton>
                </div>

                <div
                  style={{
                    border: "1px dashed #cbd5e1",
                    borderRadius: 24,
                    background: "#f8fafc",
                    padding: 40,
                    textAlign: "center",
                    color: "#64748b",
                  }}
                >
                  Crie um novo inventário para começar a contagem dos materiais.
                </div>
              </div>
            ) : (
              <div
                style={{ display: "flex", flexDirection: "column", gap: 16 }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    flexWrap: "wrap",
                    background: "#f8fafc",
                    borderRadius: 18,
                    padding: 16,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13, color: "#6b7280" }}>
                      Inventário atual
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 800 }}>
                      {currentInventory.nome}
                    </div>
                    <div
                      style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}
                    >
                      Criado em {formatDateTime(currentInventory.criadoEm)}
                    </div>
                    <div
                      style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}
                    >
                      Última alteração:{" "}
                      {formatDateTime(
                        currentInventory.atualizadoEm ||
                          currentInventory.criadoEm
                      )}
                    </div>
                    <div
                      style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}
                    >
                      Criado por: {currentInventory.criadoPor || "-"}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <ActionButton
                      kind="secondary"
                      onClick={createAnotherInventory}
                    >
                      Novo inventário
                    </ActionButton>

                    <ActionButton
                      kind="secondary"
                      onClick={addManualItemToInventory}
                    >
                      Adicionar linha manual
                    </ActionButton>

                    <ActionButton
                      kind="secondary"
                      onClick={exportCurrentInventoryCsv}
                    >
                      Exportar CSV
                    </ActionButton>

                    <ActionButton onClick={saveCurrentInventory}>
                      Salvar inventário
                    </ActionButton>
                  </div>
                </div>

                {currentInventory.itens.length ? (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 12,
                    }}
                  >
                    {currentInventory.itens.map((item) => (
                      <InventoryItemRow
                        key={item.id}
                        item={item}
                        onChange={(next) => updateInventoryItem(item.id, next)}
                        onRemove={() => removeInventoryItem(item.id)}
                      />
                    ))}
                  </div>
                ) : (
                  <div
                    style={{
                      border: "1px dashed #cbd5e1",
                      borderRadius: 24,
                      background: "#f8fafc",
                      padding: 40,
                      textAlign: "center",
                      color: "#64748b",
                    }}
                  >
                    Nenhum item adicionado ainda. Pesquise um PN e clique em
                    “Adicionar ao inventário atual” ou adicione uma linha
                    manual.
                  </div>
                )}
              </div>
            )}
          </Panel>
        )}

        {activeTab === "historico" && !canAccessInventario && (
          <LoginGate
            title="Histórico de Inventários"
            subtitle="Acesso restrito"
            onLogin={handleInventarioLogin}
            loginForm={inventarioLoginForm}
            setLoginForm={setInventarioLoginForm}
            errorMessage={inventarioLoginError}
          />
        )}

        {activeTab === "historico" && canAccessInventario && (
          <Panel
            title="Inventários salvos"
            right={
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <div
                  style={{
                    background: "#f3f4f6",
                    borderRadius: 16,
                    padding: "10px 14px",
                    fontWeight: 700,
                  }}
                >
                  👤 {authState.inventario?.nome}
                </div>
                <ActionButton
                  kind="secondary"
                  onClick={() => logoutArea("inventario")}
                >
                  Sair
                </ActionButton>
              </div>
            }
          >
            {inventories.length ? (
              <div
                style={{ display: "flex", flexDirection: "column", gap: 12 }}
              >
                {inventories.map((inv) => (
                  <div
                    key={inv.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                      flexWrap: "wrap",
                      border: "1px solid #e5e7eb",
                      borderRadius: 20,
                      padding: 16,
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700 }}>{inv.nome}</div>
                      <div
                        style={{ color: "#6b7280", fontSize: 14, marginTop: 4 }}
                      >
                        Criado em {formatDateTime(inv.criadoEm)}
                      </div>
                      <div
                        style={{ color: "#6b7280", fontSize: 14, marginTop: 4 }}
                      >
                        Atualizado em{" "}
                        {formatDateTime(inv.atualizadoEm || inv.criadoEm)}
                      </div>
                      <div
                        style={{ color: "#6b7280", fontSize: 14, marginTop: 4 }}
                      >
                        Itens: {inv.itens.length}
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <ActionButton
                        kind="secondary"
                        onClick={() => loadInventory(inv)}
                      >
                        Abrir
                      </ActionButton>
                      <ActionButton
                        kind="danger"
                        onClick={() => deleteInventory(inv.id)}
                      >
                        Excluir
                      </ActionButton>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div
                style={{
                  border: "1px dashed #cbd5e1",
                  borderRadius: 24,
                  background: "#f8fafc",
                  padding: 40,
                  textAlign: "center",
                  color: "#64748b",
                }}
              >
                Ainda não existe nenhum inventário salvo.
              </div>
            )}
          </Panel>
        )}

        {activeTab === "cadastro" && !canAccessMateriais && (
          <LoginGate
            title="Materiais cadastrados"
            subtitle="Login da área de materiais"
            onLogin={handleMateriaisLogin}
            loginForm={materiaisLoginForm}
            setLoginForm={setMateriaisLoginForm}
            errorMessage={materiaisLoginError}
          />
        )}

        {activeTab === "cadastro" && canAccessMateriais && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "0.95fr 1.05fr",
              gap: 20,
            }}
          >
            <Panel
              title="Cadastrar ou editar material"
              right={
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <div
                    style={{
                      background: "#f3f4f6",
                      borderRadius: 16,
                      padding: "10px 14px",
                      fontWeight: 700,
                    }}
                  >
                    👤 {authState.materiais?.nome}
                  </div>

                  <input
                    ref={csvInputRef}
                    type="file"
                    accept=".csv"
                    onChange={handleImportCsv}
                    style={{ display: "none" }}
                  />

                  <ActionButton
                    kind="secondary"
                    onClick={() => csvInputRef.current?.click()}
                  >
                    Importar CSV
                  </ActionButton>

                  <ActionButton kind="secondary" onClick={exportMaterialsCsv}>
                    Exportar CSV
                  </ActionButton>

                  <ActionButton
                    kind="secondary"
                    onClick={() => logoutArea("materiais")}
                  >
                    Sair
                  </ActionButton>
                </div>
              }
            >
              <div style={{ display: "grid", gap: 14 }}>
                <div
                  style={{
                    background: "#fff8d6",
                    border: "1px solid #f2c200",
                    borderRadius: 18,
                    padding: 14,
                    fontSize: 14,
                    lineHeight: 1.5,
                  }}
                >
                  <div style={{ fontWeight: 800, marginBottom: 6 }}>
                    Importação em lote
                  </div>
                  <div>Salve sua planilha como CSV e importe de uma vez.</div>
                  <div style={{ marginTop: 6 }}>
                    <strong>Colunas aceitas:</strong> PN, DESCRIÇÃO,
                    LOCALIZAÇÃO, FOTO, OBSERVAÇÃO, STATUS, QUANTIDADE
                  </div>
                  <div style={{ marginTop: 6 }}>
                    <strong>Obs:</strong> se QUANTIDADE não existir, o sistema
                    tenta ler da OBSERVAÇÃO.
                  </div>

                  {importMessage ? (
                    <div
                      style={{
                        marginTop: 10,
                        background: "white",
                        borderRadius: 14,
                        padding: 12,
                        border: "1px solid #fde68a",
                        fontWeight: 700,
                      }}
                    >
                      {importMessage}
                    </div>
                  ) : null}
                </div>

                <Field label="PN">
                  <TextInput
                    value={newMaterial.pn}
                    onChange={(e) =>
                      setNewMaterial((prev) => ({
                        ...prev,
                        pn: e.target.value,
                      }))
                    }
                    placeholder="Digite o PN"
                  />
                </Field>

                <Field label="Descrição">
                  <TextInput
                    value={newMaterial.descricao}
                    onChange={(e) =>
                      setNewMaterial((prev) => ({
                        ...prev,
                        descricao: e.target.value,
                      }))
                    }
                    placeholder="Descrição da peça"
                  />
                </Field>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 12,
                  }}
                >
                  <Field label="Localização">
                    <TextInput
                      value={newMaterial.localizacao}
                      onChange={(e) =>
                        setNewMaterial((prev) => ({
                          ...prev,
                          localizacao: e.target.value,
                        }))
                      }
                      placeholder="01.02.03.04"
                    />
                  </Field>

                  <Field label="Quantidade">
                    <TextInput
                      type="number"
                      value={newMaterial.quantidade}
                      onChange={(e) =>
                        setNewMaterial((prev) => ({
                          ...prev,
                          quantidade: e.target.value,
                        }))
                      }
                      placeholder="0"
                    />
                  </Field>
                </div>

                <Field label="Status">
                  <select
                    value={newMaterial.status}
                    onChange={(e) =>
                      setNewMaterial((prev) => ({
                        ...prev,
                        status: e.target.value,
                      }))
                    }
                    style={{
                      width: "100%",
                      minHeight: 46,
                      borderRadius: 16,
                      border: "1px solid #d1d5db",
                      padding: "12px 14px",
                      fontSize: 16,
                      outline: "none",
                      background: "white",
                    }}
                  >
                    <option value="IDENTIFICADO">IDENTIFICADO</option>
                    <option value="COMPLETO">COMPLETO</option>
                    <option value="SEM FOTO">SEM FOTO</option>
                    <option value="SEM LOCALIZAÇÃO">SEM LOCALIZAÇÃO</option>
                  </select>
                </Field>

                <Field label="Observação">
                  <TextArea
                    rows={3}
                    value={newMaterial.observacao}
                    onChange={(e) =>
                      setNewMaterial((prev) => ({
                        ...prev,
                        observacao: e.target.value,
                      }))
                    }
                    placeholder="Observações do material"
                  />
                </Field>

                <InventoryPhotoInput
                  label="Foto do material"
                  foto={newMaterial.foto}
                  onChange={(foto) =>
                    setNewMaterial((prev) => ({ ...prev, foto }))
                  }
                />

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <ActionButton onClick={saveMaterial}>
                    Salvar material
                  </ActionButton>
                  <ActionButton
                    kind="secondary"
                    onClick={() =>
                      setNewMaterial({
                        pn: "",
                        descricao: "",
                        localizacao: "",
                        quantidade: "",
                        observacao: "",
                        status: "IDENTIFICADO",
                        foto: "",
                      })
                    }
                  >
                    Limpar
                  </ActionButton>
                </div>
              </div>
            </Panel>

            <Panel title="Lista de materiais cadastrados">
              <div
                style={{ display: "flex", flexDirection: "column", gap: 12 }}
              >
                {materials.length ? (
                  materials.map((item) => (
                    <MaterialListItem
                      key={item.pn}
                      item={item}
                      onEdit={handleEditMaterial}
                      onDelete={deleteMaterial}
                    />
                  ))
                ) : (
                  <div
                    style={{
                      border: "1px dashed #cbd5e1",
                      borderRadius: 24,
                      background: "#f8fafc",
                      padding: 40,
                      textAlign: "center",
                      color: "#64748b",
                    }}
                  >
                    Nenhum material cadastrado ainda.
                  </div>
                )}
              </div>
            </Panel>
          </div>
        )}
      </div>
    </div>
  );
}
