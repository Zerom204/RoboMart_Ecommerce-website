import { useState, useEffect, useRef } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// API helpers — all calls go to /api/* which Vercel rewrites to your CF Worker
// ─────────────────────────────────────────────────────────────────────────────
const API = "/api";
async function apiFetch(path, opts = {}, token = null) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, { headers, ...opts });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

// ─────────────────────────────────────────────────────────────────────────────
// Design tokens
// ─────────────────────────────────────────────────────────────────────────────
const G = {
  pageBg: "linear-gradient(135deg,#dbeafe 0%,#eff6ff 40%,#bfdbfe 100%)",
  glassCard: "rgba(255,255,255,0.55)",
  glassCardHover: "rgba(255,255,255,0.78)",
  glassNav: "rgba(255,255,255,0.62)",
  glassModal: "rgba(255,255,255,0.78)",
  glassInput: "rgba(255,255,255,0.65)",
  border: "1px solid rgba(255,255,255,0.75)",
  borderFocus: "1px solid rgba(59,130,246,0.5)",
  shadow: "0 8px 32px rgba(59,130,246,0.12),0 2px 8px rgba(59,130,246,0.07)",
  shadowHover: "0 18px 48px rgba(59,130,246,0.22),0 4px 16px rgba(59,130,246,0.12)",
  shadowModal: "0 24px 64px rgba(59,130,246,0.22)",
  btnPrimary: "linear-gradient(135deg,#3b82f6,#1d4ed8)",
  btnSeller: "linear-gradient(135deg,#0ea5e9,#0369a1)",
  blue700: "#1d4ed8", blue600: "#2563eb", blue500: "#3b82f6",
  blue400: "#60a5fa", blue300: "#93c5fd", blue200: "#bfdbfe",
  textDark: "#1e3a5f", textMid: "#3b5998", textLight: "#6b9cce", textFaint: "#a8c4e0",
};

const glass = (extra = {}) => ({
  background: G.glassCard,
  backdropFilter: "blur(20px) saturate(180%)",
  WebkitBackdropFilter: "blur(20px) saturate(180%)",
  border: G.border,
  borderRadius: "20px",
  boxShadow: G.shadow,
  ...extra,
});

// ─────────────────────────────────────────────────────────────────────────────
// Mock product data (replaced by real D1 calls once Worker is live)
// ─────────────────────────────────────────────────────────────────────────────
const MOCK_PRODUCTS = [
  { id: 1, name: "HexaBot Pro 6-DOF Arm", price: 2499, category: "Arms", rating: 4.8, reviews: 142, stock: 12, badge: "Best Seller", image: null, emoji: "🦾", description: "Industrial-grade 6-axis robotic arm with 5kg payload, ±0.02mm repeatability, ROS2 compatible.", seller_id: 1, seller_name: "RoboWorks Inc." },
  { id: 2, name: "NanoRover Explorer Kit", price: 389, category: "Rovers", rating: 4.6, reviews: 89, stock: 34, badge: "New", image: null, emoji: "🤖", description: "Autonomous navigation rover with LIDAR, IMU, and Raspberry Pi 4 compute module included.", seller_id: 2, seller_name: "MakerSpace Labs" },
  { id: 3, name: "ServoMaster X12 Controller", price: 149, category: "Controllers", rating: 4.9, reviews: 321, stock: 87, badge: "Top Rated", image: null, emoji: "🎛️", description: "12-channel servo controller with USB-C, onboard IMU, real-time PWM generation.", seller_id: 1, seller_name: "RoboWorks Inc." },
  { id: 4, name: "OctoLeg Spider Platform", price: 1799, category: "Platforms", rating: 4.7, reviews: 56, stock: 5, badge: "Limited", image: null, emoji: "🕷️", description: "8-legged biomimetic platform, terrain-adaptive gait algorithms, IP54 rated chassis.", seller_id: 3, seller_name: "BioMech Co." },
  { id: 5, name: "VisionCore AI Camera", price: 299, category: "Sensors", rating: 4.5, reviews: 203, stock: 41, badge: "", image: null, emoji: "📷", description: "4K stereo vision camera with onboard YOLO inference, ROS2 bridge, USB3 & MIPI.", seller_id: 2, seller_name: "MakerSpace Labs" },
  { id: 6, name: "TitanGripper Soft Hand", price: 599, category: "Arms", rating: 4.6, reviews: 77, stock: 19, badge: "", image: null, emoji: "✋", description: "Pneumatic soft gripper, 3-finger design, handles irregular objects up to 2kg safely.", seller_id: 3, seller_name: "BioMech Co." },
  { id: 7, name: "PowerBase 48V Pack", price: 449, category: "Power", rating: 4.8, reviews: 115, stock: 28, badge: "", image: null, emoji: "🔋", description: "48V 20Ah LiFePO4 smart battery with CAN bus BMS and hot-swap capability.", seller_id: 1, seller_name: "RoboWorks Inc." },
  { id: 8, name: "SkyDrone Nav Module", price: 219, category: "Drones", rating: 4.4, reviews: 64, stock: 50, badge: "New", image: null, emoji: "🚁", description: "RTK-GPS + optical flow positioning module, 1cm accuracy, ArduPilot/PX4 plug-and-play.", seller_id: 2, seller_name: "MakerSpace Labs" },
];
const CATEGORIES = ["All", "Arms", "Rovers", "Controllers", "Platforms", "Sensors", "Power", "Drones"];

// ─────────────────────────────────────────────────────────────────────────────
// Hooks
// ─────────────────────────────────────────────────────────────────────────────
function useCart() {
  const [cart, setCart] = useState([]);
  const add = (p) => setCart(prev => {
    const ex = prev.find(i => i.id === p.id);
    return ex ? prev.map(i => i.id === p.id ? { ...i, qty: i.qty + 1 } : i) : [...prev, { ...p, qty: 1 }];
  });
  const remove = (id) => setCart(prev => prev.filter(i => i.id !== id));
  const update = (id, qty) => qty < 1 ? remove(id) : setCart(prev => prev.map(i => i.id === id ? { ...i, qty } : i));
  const clear = () => setCart([]);
  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const count = cart.reduce((s, i) => s + i.qty, 0);
  return { cart, add, remove, update, clear, total, count };
}

function useAuth() {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("robomart_user")); } catch { return null; }
  });
  const [token, setToken] = useState(() => localStorage.getItem("robomart_token"));

  const login = (userData, jwt) => {
    setUser(userData); setToken(jwt);
    localStorage.setItem("robomart_user", JSON.stringify(userData));
    localStorage.setItem("robomart_token", jwt);
  };
  const logout = () => {
    setUser(null); setToken(null);
    localStorage.removeItem("robomart_user");
    localStorage.removeItem("robomart_token");
  };
  return { user, token, login, logout };
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared UI atoms
// ─────────────────────────────────────────────────────────────────────────────
function StarRating({ rating }) {
  return (
    <span style={{ fontSize: "0.72rem" }}>
      <span style={{ color: "#f59e0b" }}>{"★".repeat(Math.floor(rating))}</span>
      <span style={{ color: G.blue200 }}>{"★".repeat(5 - Math.floor(rating))}</span>
      <span style={{ color: G.textLight, marginLeft: "0.3rem", fontSize: "0.68rem" }}>{rating}</span>
    </span>
  );
}

function Badge({ text }) {
  if (!text) return null;
  const map = {
    "Best Seller": "linear-gradient(135deg,#f59e0b,#f97316)",
    "New": "linear-gradient(135deg,#3b82f6,#06b6d4)",
    "Top Rated": "linear-gradient(135deg,#10b981,#3b82f6)",
    "Limited": "linear-gradient(135deg,#ef4444,#f97316)",
  };
  return (
    <span style={{ background: map[text] || G.blue500, color: "#fff", fontSize: "0.58rem", fontWeight: 800, padding: "3px 9px", borderRadius: "20px", letterSpacing: "0.12em", textTransform: "uppercase", fontFamily: "'DM Mono',monospace", boxShadow: "0 2px 8px rgba(59,130,246,0.3)" }}>{text}</span>
  );
}

function GlassInput({ label, type = "text", value, onChange, placeholder, icon }) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
      {label && <label style={{ color: G.textMid, fontSize: "0.78rem", fontWeight: 600 }}>{label}</label>}
      <div style={{ position: "relative" }}>
        {icon && <span style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", color: G.blue400, fontSize: "0.95rem", pointerEvents: "none" }}>{icon}</span>}
        <input
          type={type} value={value} onChange={onChange} placeholder={placeholder}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          style={{
            width: "100%", background: G.glassInput, backdropFilter: "blur(12px)",
            border: focused ? G.borderFocus : G.border, borderRadius: "12px",
            padding: icon ? "0.7rem 1rem 0.7rem 2.5rem" : "0.7rem 1rem",
            color: G.textDark, fontSize: "0.88rem", outline: "none",
            fontFamily: "'Outfit',sans-serif", transition: "all 0.2s",
            boxShadow: focused ? "0 0 0 3px rgba(59,130,246,0.12)" : "none",
          }}
        />
      </div>
    </div>
  );
}

function PrimaryBtn({ children, onClick, style = {}, variant = "blue", disabled = false }) {
  const [h, setH] = useState(false);
  const bg = variant === "seller" ? G.btnSeller : G.btnPrimary;
  return (
    <button
      onClick={onClick} disabled={disabled}
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{
        background: disabled ? "rgba(59,130,246,0.3)" : bg, color: "#fff",
        border: "none", borderRadius: "12px", padding: "0.75rem 1.5rem",
        fontSize: "0.88rem", fontWeight: 700, cursor: disabled ? "not-allowed" : "pointer",
        fontFamily: "'Outfit',sans-serif", transition: "all 0.2s",
        boxShadow: h && !disabled ? "0 8px 24px rgba(59,130,246,0.45)" : "0 4px 16px rgba(59,130,246,0.3)",
        transform: h && !disabled ? "translateY(-2px)" : "none",
        ...style,
      }}
    >{children}</button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Auth Modal (Sign In / Sign Up with role selection)
// ─────────────────────────────────────────────────────────────────────────────
function AuthModal({ onClose, onSuccess }) {
  const [mode, setMode] = useState("signin"); // "signin" | "signup"
  const [role, setRole] = useState("buyer");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async () => {
    setError(""); setLoading(true);
    try {
      const endpoint = mode === "signin" ? "/auth/signin" : "/auth/signup";
      const body = mode === "signup"
        ? { name: form.name, email: form.email, password: form.password, role }
        : { email: form.email, password: form.password };

      const data = await apiFetch(endpoint, { method: "POST", body: JSON.stringify(body) });
      onSuccess(data.user, data.token);
      onClose();
    } catch (err) {
      // Demo mode: simulate login locally when Worker not connected
      if (mode === "signin") {
        const mockUser = { id: Date.now(), name: form.email.split("@")[0], email: form.email, role: form.email.includes("seller") ? "seller" : "buyer" };
        onSuccess(mockUser, "demo-token");
        onClose();
      } else {
        const mockUser = { id: Date.now(), name: form.name, email: form.email, role };
        onSuccess(mockUser, "demo-token");
        onClose();
      }
    } finally { setLoading(false); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(191,219,254,0.55)", backdropFilter: "blur(10px)" }} />
      <div style={{ ...glass({ borderRadius: "24px", padding: "2.5rem", maxWidth: "420px", width: "100%", boxShadow: G.shadowModal }), position: "relative", zIndex: 1, background: G.glassModal }}>
        <button onClick={onClose} style={{ position: "absolute", top: "1rem", right: "1rem", background: "rgba(59,130,246,0.1)", border: "none", color: G.blue500, width: "32px", height: "32px", borderRadius: "50%", cursor: "pointer", fontSize: "1rem" }}>✕</button>

        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: "1.75rem" }}>
          <div style={{ width: "52px", height: "52px", borderRadius: "16px", background: G.btnPrimary, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.5rem", margin: "0 auto 0.75rem", boxShadow: "0 6px 20px rgba(59,130,246,0.35)" }}>⚙️</div>
          <h2 style={{ color: G.textDark, fontFamily: "'Outfit',sans-serif", fontWeight: 800, fontSize: "1.4rem", marginBottom: "0.25rem" }}>
            {mode === "signin" ? "Welcome back" : "Create account"}
          </h2>
          <p style={{ color: G.textLight, fontSize: "0.82rem" }}>
            {mode === "signin" ? "Sign in to your RoboMart account" : "Join RoboMart today"}
          </p>
        </div>

        {/* Mode toggle */}
        <div style={{ display: "flex", background: "rgba(219,234,254,0.5)", borderRadius: "12px", padding: "4px", marginBottom: "1.5rem", border: "1px solid rgba(255,255,255,0.7)" }}>
          {["signin", "signup"].map(m => (
            <button key={m} onClick={() => { setMode(m); setError(""); }} style={{
              flex: 1, padding: "0.55rem", border: "none", borderRadius: "9px",
              background: mode === m ? "#fff" : "transparent",
              color: mode === m ? G.blue700 : G.textLight,
              fontWeight: mode === m ? 700 : 500, fontSize: "0.82rem",
              cursor: "pointer", fontFamily: "'Outfit',sans-serif",
              boxShadow: mode === m ? "0 2px 8px rgba(59,130,246,0.15)" : "none",
              transition: "all 0.2s",
            }}>{m === "signin" ? "Sign In" : "Sign Up"}</button>
          ))}
        </div>

        {/* Role selector (signup only) */}
        {mode === "signup" && (
          <div style={{ marginBottom: "1.25rem" }}>
            <label style={{ color: G.textMid, fontSize: "0.78rem", fontWeight: 600, display: "block", marginBottom: "0.5rem" }}>I want to</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              {[
                { val: "buyer", icon: "🛒", title: "Buy Products", desc: "Browse & purchase robotics" },
                { val: "seller", icon: "📦", title: "Sell Products", desc: "List & manage products" },
              ].map(({ val, icon, title, desc }) => (
                <div key={val} onClick={() => setRole(val)} style={{
                  background: role === val ? "rgba(59,130,246,0.12)" : "rgba(255,255,255,0.5)",
                  border: role === val ? "2px solid rgba(59,130,246,0.5)" : "2px solid rgba(255,255,255,0.7)",
                  borderRadius: "14px", padding: "1rem 0.75rem", cursor: "pointer",
                  textAlign: "center", transition: "all 0.2s",
                  boxShadow: role === val ? "0 4px 16px rgba(59,130,246,0.15)" : "none",
                }}>
                  <div style={{ fontSize: "1.6rem", marginBottom: "0.3rem" }}>{icon}</div>
                  <div style={{ color: G.textDark, fontWeight: 700, fontSize: "0.82rem" }}>{title}</div>
                  <div style={{ color: G.textLight, fontSize: "0.68rem", marginTop: "2px" }}>{desc}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Form fields */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "1.25rem" }}>
          {mode === "signup" && (
            <GlassInput label="Full Name" value={form.name} onChange={set("name")} placeholder="John Doe" icon="👤" />
          )}
          <GlassInput label="Email" type="email" value={form.email} onChange={set("email")} placeholder="you@example.com" icon="✉️" />
          <GlassInput label="Password" type="password" value={form.password} onChange={set("password")} placeholder="••••••••" icon="🔒" />
        </div>

        {error && <p style={{ color: "#ef4444", fontSize: "0.78rem", marginBottom: "1rem", background: "rgba(239,68,68,0.08)", padding: "0.6rem 0.9rem", borderRadius: "10px" }}>{error}</p>}

        <PrimaryBtn onClick={handleSubmit} disabled={loading} style={{ width: "100%", padding: "0.9rem" }}>
          {loading ? "Loading..." : mode === "signin" ? "Sign In →" : `Create ${role === "seller" ? "Seller" : "Buyer"} Account →`}
        </PrimaryBtn>

        <p style={{ textAlign: "center", color: G.textLight, fontSize: "0.75rem", marginTop: "1rem" }}>
          {mode === "signin" ? "No account? " : "Already have one? "}
          <span onClick={() => setMode(mode === "signin" ? "signup" : "signin")} style={{ color: G.blue600, cursor: "pointer", fontWeight: 700 }}>
            {mode === "signin" ? "Sign up" : "Sign in"}
          </span>
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Seller: Add Product Modal
// ─────────────────────────────────────────────────────────────────────────────
function AddProductModal({ onClose, onAdd, token, user }) {
  const [form, setForm] = useState({ name: "", price: "", category: "Arms", stock: "", description: "", badge: "" });
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef();

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleImage = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (!form.name || !form.price || !form.stock || !form.description) { setError("Please fill in all required fields."); return; }
    setError(""); setLoading(true);
    try {
      let imageUrl = null;
      // Upload image to Cloudflare R2 via Worker
      if (imageFile) {
        const fd = new FormData();
        fd.append("file", imageFile);
        const up = await fetch(`${API}/upload`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd });
        const upData = await up.json();
        imageUrl = upData.url;
      }
      const product = { ...form, price: parseFloat(form.price), stock: parseInt(form.stock), image: imageUrl, seller_id: user.id, seller_name: user.name };
      const created = await apiFetch("/products", { method: "POST", body: JSON.stringify(product) }, token);
      onAdd({ ...product, id: created.id, emoji: "📦", rating: 0, reviews: 0 });
      onClose();
    } catch {
      // Demo mode: add locally
      const newProd = { ...form, id: Date.now(), price: parseFloat(form.price), stock: parseInt(form.stock), image: imagePreview, emoji: "📦", rating: 0, reviews: 0, seller_id: user.id, seller_name: user.name };
      onAdd(newProd);
      onClose();
    } finally { setLoading(false); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem", overflowY: "auto" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(191,219,254,0.55)", backdropFilter: "blur(10px)" }} />
      <div style={{ ...glass({ borderRadius: "24px", padding: "2.5rem", maxWidth: "540px", width: "100%", boxShadow: G.shadowModal }), position: "relative", zIndex: 1, background: G.glassModal, maxHeight: "90vh", overflowY: "auto" }}>
        <button onClick={onClose} style={{ position: "absolute", top: "1rem", right: "1rem", background: "rgba(59,130,246,0.1)", border: "none", color: G.blue500, width: "32px", height: "32px", borderRadius: "50%", cursor: "pointer", fontSize: "1rem" }}>✕</button>

        <h2 style={{ color: G.textDark, fontFamily: "'Outfit',sans-serif", fontWeight: 800, fontSize: "1.35rem", marginBottom: "0.25rem" }}>Add New Product</h2>
        <p style={{ color: G.textLight, fontSize: "0.8rem", marginBottom: "1.75rem" }}>List your robotics product on RoboMart</p>

        {/* Image upload */}
        <div style={{ marginBottom: "1.25rem" }}>
          <label style={{ color: G.textMid, fontSize: "0.78rem", fontWeight: 600, display: "block", marginBottom: "0.5rem" }}>Product Image</label>
          <div
            onClick={() => fileRef.current.click()}
            style={{
              background: imagePreview ? "transparent" : "rgba(219,234,254,0.5)",
              border: "2px dashed rgba(59,130,246,0.35)", borderRadius: "16px",
              height: "150px", display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", overflow: "hidden", transition: "all 0.2s",
              position: "relative",
            }}
          >
            {imagePreview
              ? <img src={imagePreview} alt="preview" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "14px" }} />
              : <div style={{ textAlign: "center", color: G.textLight }}>
                  <div style={{ fontSize: "2rem", marginBottom: "0.4rem" }}>📸</div>
                  <div style={{ fontSize: "0.78rem" }}>Click to upload image</div>
                  <div style={{ fontSize: "0.68rem", color: G.textFaint, marginTop: "2px" }}>PNG, JPG up to 5MB</div>
                </div>
            }
            {imagePreview && (
              <button onClick={(e) => { e.stopPropagation(); setImagePreview(null); setImageFile(null); }} style={{ position: "absolute", top: "8px", right: "8px", background: "rgba(239,68,68,0.85)", border: "none", color: "#fff", width: "26px", height: "26px", borderRadius: "50%", cursor: "pointer", fontSize: "0.75rem" }}>✕</button>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" onChange={handleImage} style={{ display: "none" }} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
          <div style={{ gridColumn: "1/-1" }}>
            <GlassInput label="Product Name *" value={form.name} onChange={set("name")} placeholder="e.g. HexaBot Pro Arm" />
          </div>
          <GlassInput label="Price (USD) *" type="number" value={form.price} onChange={set("price")} placeholder="0.00" icon="$" />
          <GlassInput label="Stock Qty *" type="number" value={form.stock} onChange={set("stock")} placeholder="0" />
          <div>
            <label style={{ color: G.textMid, fontSize: "0.78rem", fontWeight: 600, display: "block", marginBottom: "0.4rem" }}>Category</label>
            <select value={form.category} onChange={set("category")} style={{ width: "100%", background: G.glassInput, border: G.border, borderRadius: "12px", padding: "0.7rem 1rem", color: G.textDark, fontSize: "0.88rem", outline: "none", fontFamily: "'Outfit',sans-serif" }}>
              {CATEGORIES.filter(c => c !== "All").map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label style={{ color: G.textMid, fontSize: "0.78rem", fontWeight: 600, display: "block", marginBottom: "0.4rem" }}>Badge</label>
            <select value={form.badge} onChange={set("badge")} style={{ width: "100%", background: G.glassInput, border: G.border, borderRadius: "12px", padding: "0.7rem 1rem", color: G.textDark, fontSize: "0.88rem", outline: "none", fontFamily: "'Outfit',sans-serif" }}>
              <option value="">None</option>
              {["New", "Best Seller", "Top Rated", "Limited"].map(b => <option key={b}>{b}</option>)}
            </select>
          </div>
          <div style={{ gridColumn: "1/-1" }}>
            <label style={{ color: G.textMid, fontSize: "0.78rem", fontWeight: 600, display: "block", marginBottom: "0.4rem" }}>Description *</label>
            <textarea value={form.description} onChange={set("description")} placeholder="Describe your product specifications, features..." rows={3} style={{ width: "100%", background: G.glassInput, border: G.border, borderRadius: "12px", padding: "0.7rem 1rem", color: G.textDark, fontSize: "0.85rem", outline: "none", fontFamily: "'Outfit',sans-serif", resize: "vertical", lineHeight: 1.6 }} />
          </div>
        </div>

        {error && <p style={{ color: "#ef4444", fontSize: "0.78rem", marginBottom: "1rem", background: "rgba(239,68,68,0.08)", padding: "0.6rem 0.9rem", borderRadius: "10px" }}>{error}</p>}

        <div style={{ display: "flex", gap: "0.75rem" }}>
          <button onClick={onClose} style={{ flex: 1, padding: "0.85rem", background: "rgba(255,255,255,0.6)", border: G.border, borderRadius: "12px", color: G.textMid, fontWeight: 600, cursor: "pointer", fontFamily: "'Outfit',sans-serif" }}>Cancel</button>
          <PrimaryBtn onClick={handleSubmit} disabled={loading} style={{ flex: 2 }} variant="seller">
            {loading ? "Publishing..." : "🚀 Publish Product"}
          </PrimaryBtn>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Product Card
// ─────────────────────────────────────────────────────────────────────────────
function ProductCard({ product, onAdd, onView, onBuyNow, userRole }) {
  const [h, setH] = useState(false);
  const canBuy = userRole === "buyer";
  const isGuest = !userRole;

  return (
    <div
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{
        background: h ? G.glassCardHover : G.glassCard,
        backdropFilter: "blur(20px) saturate(180%)", WebkitBackdropFilter: "blur(20px) saturate(180%)",
        border: h ? "1px solid rgba(255,255,255,0.92)" : G.border,
        borderRadius: "20px", boxShadow: h ? G.shadowHover : G.shadow,
        transition: "all 0.3s cubic-bezier(0.4,0,0.2,1)", transform: h ? "translateY(-6px)" : "none",
        padding: "1.4rem", display: "flex", flexDirection: "column", gap: "0.85rem",
      }}
    >
      {/* Image / emoji */}
      <div onClick={() => onView(product)} style={{ background: "linear-gradient(135deg,rgba(219,234,254,0.85),rgba(191,219,254,0.65))", borderRadius: "14px", height: "140px", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid rgba(255,255,255,0.8)", position: "relative", cursor: "pointer", overflow: "hidden" }}>
        {product.image
          ? <img src={product.image} alt={product.name} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "13px" }} />
          : <span style={{ fontSize: "3.8rem" }}>{product.emoji || "📦"}</span>
        }
        <div style={{ position: "absolute", top: "10px", left: "10px" }}><Badge text={product.badge} /></div>
      </div>

      <span style={{ color: G.blue600, fontSize: "0.6rem", letterSpacing: "0.18em", textTransform: "uppercase", fontFamily: "'DM Mono',monospace", fontWeight: 700 }}>{product.category}</span>

      <div onClick={() => onView(product)} style={{ color: G.textDark, fontSize: "0.92rem", fontWeight: 700, lineHeight: 1.3, fontFamily: "'Outfit',sans-serif", cursor: "pointer" }}>{product.name}</div>

      {product.rating > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
          <StarRating rating={product.rating} />
          <span style={{ color: G.textFaint, fontSize: "0.66rem" }}>({product.reviews})</span>
        </div>
      )}

      <div style={{ fontSize: "0.68rem", color: G.textLight, fontFamily: "'DM Mono',monospace" }}>by {product.seller_name || "RoboMart Seller"}</div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "auto" }}>
        <div>
          <div style={{ color: G.blue700, fontSize: "1.2rem", fontWeight: 800, fontFamily: "'DM Mono',monospace" }}>${product.price?.toLocaleString()}</div>
          {product.stock < 10 && product.stock > 0 && <div style={{ color: "#ef4444", fontSize: "0.6rem", marginTop: "2px" }}>Only {product.stock} left</div>}
          {product.stock === 0 && <div style={{ color: "#ef4444", fontSize: "0.6rem", marginTop: "2px" }}>Out of stock</div>}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", alignItems: "flex-end" }}>
          {(canBuy || isGuest) && (
            <button onClick={(e) => { e.stopPropagation(); onAdd(product); }} disabled={product.stock === 0}
              style={{ background: G.btnPrimary, color: "#fff", border: "none", borderRadius: "10px", padding: "0.48rem 0.9rem", fontSize: "0.72rem", fontWeight: 700, cursor: product.stock === 0 ? "not-allowed" : "pointer", fontFamily: "'DM Mono',monospace", boxShadow: "0 3px 12px rgba(59,130,246,0.35)", opacity: product.stock === 0 ? 0.5 : 1, whiteSpace: "nowrap" }}>
              + Cart
            </button>
          )}
          {canBuy && (
            <button onClick={(e) => { e.stopPropagation(); onBuyNow(product); }} disabled={product.stock === 0}
              style={{ background: "linear-gradient(135deg,#10b981,#059669)", color: "#fff", border: "none", borderRadius: "10px", padding: "0.48rem 0.9rem", fontSize: "0.72rem", fontWeight: 700, cursor: product.stock === 0 ? "not-allowed" : "pointer", fontFamily: "'DM Mono',monospace", boxShadow: "0 3px 12px rgba(16,185,129,0.35)", opacity: product.stock === 0 ? 0.5 : 1, whiteSpace: "nowrap" }}>
              Buy Now
            </button>
          )}
          {!canBuy && !isGuest && (
            <span style={{ color: G.textFaint, fontSize: "0.65rem", fontStyle: "italic" }}>Seller view</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Product Detail Modal
// ─────────────────────────────────────────────────────────────────────────────
function ProductModal({ product, onClose, onAdd, onBuyNow, userRole }) {
  if (!product) return null;
  const canBuy = userRole === "buyer" || !userRole;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 900, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(191,219,254,0.5)", backdropFilter: "blur(10px)" }} />
      <div style={{ ...glass({ borderRadius: "24px", padding: "2.5rem", maxWidth: "540px", width: "100%", boxShadow: G.shadowModal }), position: "relative", zIndex: 1, background: G.glassModal, maxHeight: "90vh", overflowY: "auto" }}>
        <button onClick={onClose} style={{ position: "absolute", top: "1.25rem", right: "1.25rem", background: "rgba(59,130,246,0.1)", border: "none", color: G.blue500, width: "36px", height: "36px", borderRadius: "50%", cursor: "pointer", fontSize: "1rem" }}>✕</button>

        <div style={{ background: "linear-gradient(135deg,rgba(219,234,254,0.9),rgba(191,219,254,0.7))", borderRadius: "18px", height: "200px", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid rgba(255,255,255,0.8)", marginBottom: "1.5rem", overflow: "hidden" }}>
          {product.image ? <img src={product.image} alt={product.name} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "17px" }} /> : <span style={{ fontSize: "5.5rem" }}>{product.emoji || "📦"}</span>}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
          <span style={{ color: G.blue600, fontSize: "0.62rem", letterSpacing: "0.15em", textTransform: "uppercase", fontFamily: "'DM Mono',monospace", fontWeight: 700 }}>{product.category}</span>
          <Badge text={product.badge} />
        </div>
        <h2 style={{ color: G.textDark, fontFamily: "'Outfit',sans-serif", fontSize: "1.35rem", fontWeight: 800, marginBottom: "0.4rem" }}>{product.name}</h2>
        {product.rating > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
            <StarRating rating={product.rating} />
            <span style={{ color: G.textFaint, fontSize: "0.72rem" }}>({product.reviews} reviews)</span>
          </div>
        )}
        <div style={{ color: G.textLight, fontSize: "0.75rem", marginBottom: "1rem" }}>Sold by <span style={{ color: G.blue600, fontWeight: 600 }}>{product.seller_name || "RoboMart Seller"}</span></div>

        <p style={{ color: G.textMid, fontSize: "0.88rem", lineHeight: 1.7, marginBottom: "1.5rem", fontFamily: "'Outfit',sans-serif" }}>{product.description}</p>

        <div style={{ background: "rgba(255,255,255,0.6)", borderRadius: "14px", padding: "0.75rem 1rem", marginBottom: "1.5rem", border: "1px solid rgba(255,255,255,0.8)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ color: G.textLight, fontSize: "0.8rem" }}>Stock: {product.stock} units</span>
          <span style={{ color: product.stock < 10 ? "#ef4444" : "#10b981", fontSize: "0.75rem", fontWeight: 700 }}>{product.stock === 0 ? "Out of stock" : product.stock < 10 ? "Low stock" : "Available"}</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ color: G.blue700, fontSize: "1.9rem", fontWeight: 800, fontFamily: "'DM Mono',monospace" }}>${product.price?.toLocaleString()}</span>
          {canBuy && (
            <div style={{ display: "flex", gap: "0.75rem" }}>
              <button onClick={() => { onAdd(product); onClose(); }} disabled={product.stock === 0} style={{ background: G.btnPrimary, color: "#fff", border: "none", borderRadius: "12px", padding: "0.75rem 1.25rem", fontSize: "0.85rem", fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 16px rgba(59,130,246,0.35)", opacity: product.stock === 0 ? 0.5 : 1 }}>+ Cart</button>
              <button onClick={() => { onBuyNow(product); onClose(); }} disabled={product.stock === 0} style={{ background: "linear-gradient(135deg,#10b981,#059669)", color: "#fff", border: "none", borderRadius: "12px", padding: "0.75rem 1.25rem", fontSize: "0.85rem", fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 16px rgba(16,185,129,0.35)", opacity: product.stock === 0 ? 0.5 : 1 }}>Buy Now</button>
            </div>
          )}
          {userRole === "seller" && <span style={{ color: G.textFaint, fontSize: "0.8rem", fontStyle: "italic" }}>You're viewing as a seller</span>}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Cart Drawer
// ─────────────────────────────────────────────────────────────────────────────
function CartDrawer({ cart, onRemove, onUpdate, total, onClose, onCheckout }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex" }}>
      <div onClick={onClose} style={{ flex: 1, background: "rgba(191,219,254,0.4)", backdropFilter: "blur(8px)" }} />
      <div style={{ width: "min(400px,95vw)", background: "rgba(240,248,255,0.88)", backdropFilter: "blur(32px) saturate(200%)", WebkitBackdropFilter: "blur(32px) saturate(200%)", borderLeft: "1px solid rgba(255,255,255,0.8)", boxShadow: "-8px 0 40px rgba(59,130,246,0.15)", padding: "2rem", overflowY: "auto", display: "flex", flexDirection: "column", gap: "1rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ color: G.textDark, fontFamily: "'Outfit',sans-serif", fontSize: "1.3rem", fontWeight: 800 }}>Cart <span style={{ color: G.blue500, fontSize: "0.9rem" }}>({cart.length})</span></h2>
          <button onClick={onClose} style={{ background: "rgba(59,130,246,0.1)", border: "none", color: G.blue500, width: "32px", height: "32px", borderRadius: "50%", cursor: "pointer", fontSize: "1rem" }}>✕</button>
        </div>
        {cart.length === 0 && <div style={{ textAlign: "center", padding: "3rem 1rem", color: G.textFaint }}><div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🛒</div><p>Your cart is empty</p></div>}
        {cart.map(item => (
          <div key={item.id} style={{ background: "rgba(255,255,255,0.6)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.8)", borderRadius: "16px", padding: "1rem", display: "flex", gap: "0.75rem", alignItems: "center" }}>
            <div style={{ width: "48px", height: "48px", background: "rgba(219,234,254,0.7)", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.6rem", overflow: "hidden", flexShrink: 0 }}>
              {item.image ? <img src={item.image} alt={item.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (item.emoji || "📦")}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ color: G.textDark, fontSize: "0.82rem", fontWeight: 600 }}>{item.name}</div>
              <div style={{ color: G.blue600, fontSize: "0.78rem", fontFamily: "'DM Mono',monospace" }}>${item.price?.toLocaleString()}</div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginTop: "0.4rem" }}>
                <button onClick={() => onUpdate(item.id, item.qty - 1)} style={{ background: "rgba(59,130,246,0.12)", border: "none", color: G.blue600, width: "24px", height: "24px", borderRadius: "8px", cursor: "pointer" }}>-</button>
                <span style={{ color: G.textDark, fontSize: "0.8rem", minWidth: "1.2rem", textAlign: "center", fontFamily: "'DM Mono',monospace" }}>{item.qty}</span>
                <button onClick={() => onUpdate(item.id, item.qty + 1)} style={{ background: "rgba(59,130,246,0.12)", border: "none", color: G.blue600, width: "24px", height: "24px", borderRadius: "8px", cursor: "pointer" }}>+</button>
                <button onClick={() => onRemove(item.id)} style={{ background: "rgba(239,68,68,0.1)", border: "none", color: "#ef4444", width: "24px", height: "24px", borderRadius: "8px", cursor: "pointer", marginLeft: "0.25rem" }}>✕</button>
              </div>
            </div>
            <div style={{ color: G.blue700, fontFamily: "'DM Mono',monospace", fontSize: "0.85rem", fontWeight: 700 }}>${(item.price * item.qty).toLocaleString()}</div>
          </div>
        ))}
        {cart.length > 0 && (
          <div style={{ marginTop: "auto" }}>
            <div style={{ background: "rgba(255,255,255,0.6)", borderRadius: "16px", padding: "1rem 1.25rem", border: "1px solid rgba(255,255,255,0.8)", marginBottom: "1rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                <span style={{ color: G.textLight, fontSize: "0.82rem" }}>Subtotal</span>
                <span style={{ color: G.textDark, fontFamily: "'DM Mono',monospace", fontSize: "0.85rem" }}>${total.toLocaleString()}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: G.textLight, fontSize: "0.82rem" }}>Shipping</span>
                <span style={{ color: "#10b981", fontSize: "0.82rem", fontWeight: 600 }}>Free</span>
              </div>
            </div>
            <button onClick={onCheckout} style={{ width: "100%", padding: "1rem", background: G.btnPrimary, color: "#fff", border: "none", borderRadius: "16px", fontWeight: 800, fontSize: "0.9rem", cursor: "pointer", fontFamily: "'Outfit',sans-serif", boxShadow: "0 8px 24px rgba(59,130,246,0.4)" }}>
              Checkout — ${total.toLocaleString()}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Seller Dashboard
// ─────────────────────────────────────────────────────────────────────────────
function SellerDashboard({ user, products, onAddProduct, onClose }) {
  const myProducts = products.filter(p => p.seller_id === user.id || p.seller_name === user.name);
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 900, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "2rem 1rem", overflowY: "auto" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(191,219,254,0.5)", backdropFilter: "blur(10px)" }} />
      <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: "700px" }}>
        <div style={{ ...glass({ borderRadius: "24px", padding: "2rem", background: G.glassModal, boxShadow: G.shadowModal }) }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
            <div>
              <h2 style={{ color: G.textDark, fontFamily: "'Outfit',sans-serif", fontWeight: 800, fontSize: "1.35rem" }}>Seller Dashboard</h2>
              <p style={{ color: G.textLight, fontSize: "0.8rem", marginTop: "2px" }}>Welcome, {user.name}</p>
            </div>
            <div style={{ display: "flex", gap: "0.75rem" }}>
              <PrimaryBtn onClick={onAddProduct} variant="seller">+ Add Product</PrimaryBtn>
              <button onClick={onClose} style={{ background: "rgba(59,130,246,0.1)", border: "none", color: G.blue500, width: "36px", height: "36px", borderRadius: "50%", cursor: "pointer", fontSize: "1rem" }}>✕</button>
            </div>
          </div>

          {/* Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "0.75rem", marginBottom: "1.5rem" }}>
            {[
              { label: "Products Listed", value: myProducts.length, icon: "📦" },
              { label: "Total Revenue", value: `$${myProducts.reduce((s, p) => s + p.price, 0).toLocaleString()}`, icon: "💰" },
              { label: "Avg Rating", value: myProducts.filter(p => p.rating > 0).length ? (myProducts.filter(p => p.rating > 0).reduce((s, p) => s + p.rating, 0) / myProducts.filter(p => p.rating > 0).length).toFixed(1) : "—", icon: "⭐" },
            ].map(({ label, value, icon }) => (
              <div key={label} style={{ background: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.8)", borderRadius: "16px", padding: "1rem", textAlign: "center" }}>
                <div style={{ fontSize: "1.5rem", marginBottom: "0.35rem" }}>{icon}</div>
                <div style={{ color: G.blue700, fontWeight: 800, fontSize: "1.1rem", fontFamily: "'DM Mono',monospace" }}>{value}</div>
                <div style={{ color: G.textLight, fontSize: "0.68rem", marginTop: "2px" }}>{label}</div>
              </div>
            ))}
          </div>

          {/* My products */}
          <h3 style={{ color: G.textDark, fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: "0.95rem", marginBottom: "0.75rem" }}>Your Listings</h3>
          {myProducts.length === 0
            ? <div style={{ textAlign: "center", padding: "2.5rem", color: G.textFaint }}><div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>📭</div><p>No products yet. Add your first product!</p></div>
            : <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {myProducts.map(p => (
                  <div key={p.id} style={{ background: "rgba(255,255,255,0.55)", border: "1px solid rgba(255,255,255,0.8)", borderRadius: "14px", padding: "1rem", display: "flex", alignItems: "center", gap: "1rem" }}>
                    <div style={{ width: "52px", height: "52px", background: "rgba(219,234,254,0.7)", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.6rem", overflow: "hidden", flexShrink: 0 }}>
                      {p.image ? <img src={p.image} alt={p.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (p.emoji || "📦")}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: G.textDark, fontWeight: 700, fontSize: "0.88rem" }}>{p.name}</div>
                      <div style={{ color: G.textLight, fontSize: "0.72rem", marginTop: "2px" }}>{p.category} · {p.stock} in stock</div>
                    </div>
                    <div style={{ color: G.blue700, fontFamily: "'DM Mono',monospace", fontWeight: 800 }}>${p.price?.toLocaleString()}</div>
                    {p.badge && <Badge text={p.badge} />}
                  </div>
                ))}
              </div>
          }
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main App
// ─────────────────────────────────────────────────────────────────────────────
export default function App() {
  const { cart, add, remove, update, clear, total, count } = useCart();
  const { user, token, login, logout } = useAuth();
  const [products, setProducts] = useState(MOCK_PRODUCTS);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [sort, setSort] = useState("default");

  // UI state
  const [cartOpen, setCartOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [viewProduct, setViewProduct] = useState(null);
  const [addProductOpen, setAddProductOpen] = useState(false);
  const [dashboardOpen, setDashboardOpen] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [buyNowProduct, setBuyNowProduct] = useState(null);

  useEffect(() => {
    setLoading(true);
    apiFetch("/products")
      .then(data => setProducts(data))
      .catch(() => setProducts(MOCK_PRODUCTS))
      .finally(() => setLoading(false));
  }, []);

  const addToast = (msg, type = "success") => {
    const id = Date.now();
    setToasts(t => [...t, { id, msg, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 2800);
  };

  const handleAdd = (p) => {
    if (user?.role === "seller") { addToast("Sellers cannot add to cart", "warn"); return; }
    add(p);
    addToast(`${p.name} added to cart`);
  };

  const handleBuyNow = (p) => {
    if (!user) { setAuthOpen(true); addToast("Sign in to purchase", "warn"); return; }
    if (user.role === "seller") { addToast("Sellers cannot purchase products", "warn"); return; }
    add(p);
    setCartOpen(true);
    addToast(`${p.name} — ready to checkout!`);
  };

  const handleCheckout = async () => {
    if (!user) { setCartOpen(false); setAuthOpen(true); return; }
    try {
      await apiFetch("/orders", { method: "POST", body: JSON.stringify({ items: cart, total }) }, token);
      clear();
      setCartOpen(false);
      addToast("Order placed successfully! 🎉");
    } catch {
      // Demo mode
      clear();
      setCartOpen(false);
      addToast("Order placed! (Demo mode) 🎉");
    }
  };

  const handleAddProduct = (p) => {
    setProducts(prev => [p, ...prev]);
    addToast(`"${p.name}" listed successfully!`);
  };

  const filtered = products
    .filter(p => category === "All" || p.category === category)
    .filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.category.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sort === "price-asc") return a.price - b.price;
      if (sort === "price-desc") return b.price - a.price;
      if (sort === "rating") return b.rating - a.rating;
      return 0;
    });

  const isSeller = user?.role === "seller";
  const isBuyer = user?.role === "buyer";

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #dbeafe; color: #1e3a5f; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: rgba(219,234,254,0.5); }
        ::-webkit-scrollbar-thumb { background: rgba(59,130,246,0.3); border-radius: 10px; }
        input::placeholder, textarea::placeholder { color: #93c5fd; }
        select option { background: #eff6ff; color: #1e3a5f; }
        textarea { resize: vertical; }
      `}</style>

      <div style={{ minHeight: "100vh", background: G.pageBg, fontFamily: "'Outfit',sans-serif", position: "relative" }}>
        {/* Orbs */}
        <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0 }}>
          {[["20% 20%","#93c5fd88","55%"],["80% 80%","#3b82f688","55%"],["60% 10%","#bfdbfe66","40%"]].map(([pos, col, size], i) => (
            <div key={i} style={{ position: "absolute", inset: 0, background: `radial-gradient(circle at ${pos},${col} 0%,transparent ${size})` }} />
          ))}
        </div>

        <div style={{ position: "relative", zIndex: 1 }}>
          {/* ── Navbar ── */}
          <nav style={{ position: "sticky", top: 0, zIndex: 500, background: G.glassNav, backdropFilter: "blur(24px) saturate(200%)", WebkitBackdropFilter: "blur(24px) saturate(200%)", borderBottom: "1px solid rgba(255,255,255,0.75)", boxShadow: "0 4px 24px rgba(59,130,246,0.1)", padding: "0 1.5rem", height: "68px", display: "flex", alignItems: "center", gap: "1rem" }}>
            {/* Logo */}
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexShrink: 0 }}>
              <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: G.btnPrimary, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.1rem", boxShadow: "0 4px 12px rgba(59,130,246,0.35)" }}>⚙️</div>
              <span style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 800, fontSize: "1.2rem", color: G.textDark, letterSpacing: "-0.03em" }}>Robo<span style={{ color: G.blue600 }}>Mart</span></span>
            </div>

            {/* Search */}
            <div style={{ flex: 1, maxWidth: "460px", position: "relative" }}>
              <span style={{ position: "absolute", left: "13px", top: "50%", transform: "translateY(-50%)", color: G.blue400, fontSize: "1rem" }}>⌕</span>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search robotics products..."
                style={{ width: "100%", background: "rgba(255,255,255,0.6)", border: G.border, borderRadius: "13px", padding: "0.6rem 1rem 0.6rem 2.4rem", color: G.textDark, fontSize: "0.84rem", outline: "none", fontFamily: "'Outfit',sans-serif" }}
                onFocus={e => { e.target.style.border = G.borderFocus; e.target.style.boxShadow = "0 0 0 3px rgba(59,130,246,0.1)"; }}
                onBlur={e => { e.target.style.border = G.border; e.target.style.boxShadow = "none"; }}
              />
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginLeft: "auto" }}>
              {/* Role badge */}
              {user && (
                <div style={{ background: isSeller ? "rgba(14,165,233,0.15)" : "rgba(59,130,246,0.12)", border: isSeller ? "1px solid rgba(14,165,233,0.35)" : "1px solid rgba(59,130,246,0.25)", borderRadius: "10px", padding: "0.35rem 0.75rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                  <span style={{ fontSize: "0.8rem" }}>{isSeller ? "📦" : "🛒"}</span>
                  <span style={{ color: isSeller ? "#0ea5e9" : G.blue600, fontSize: "0.72rem", fontWeight: 700 }}>{isSeller ? "Seller" : "Buyer"}</span>
                </div>
              )}

              {/* Seller actions */}
              {isSeller && (
                <>
                  <button onClick={() => setDashboardOpen(true)} style={{ background: "rgba(14,165,233,0.12)", border: "1px solid rgba(14,165,233,0.3)", borderRadius: "12px", padding: "0.55rem 0.9rem", color: "#0369a1", cursor: "pointer", fontSize: "0.8rem", fontWeight: 600 }}>Dashboard</button>
                  <button onClick={() => setAddProductOpen(true)} style={{ background: G.btnSeller, color: "#fff", border: "none", borderRadius: "12px", padding: "0.55rem 0.9rem", cursor: "pointer", fontSize: "0.8rem", fontWeight: 700, boxShadow: "0 3px 12px rgba(14,165,233,0.35)" }}>+ Add Product</button>
                </>
              )}

              {/* Cart (buyers & guests) */}
              {!isSeller && (
                <button onClick={() => setCartOpen(true)} style={{ position: "relative", background: "rgba(255,255,255,0.6)", border: G.border, borderRadius: "13px", padding: "0.6rem 1.1rem", color: G.textDark, cursor: "pointer", fontSize: "0.84rem", display: "flex", alignItems: "center", gap: "0.4rem", fontWeight: 600 }}>
                  🛒 Cart
                  {count > 0 && <span style={{ position: "absolute", top: "-7px", right: "-7px", background: G.btnPrimary, color: "#fff", borderRadius: "50%", width: "19px", height: "19px", fontSize: "0.6rem", fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid rgba(255,255,255,0.9)" }}>{count}</span>}
                </button>
              )}

              {/* Auth */}
              {user
                ? <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <div style={{ background: "rgba(255,255,255,0.6)", border: G.border, borderRadius: "12px", padding: "0.5rem 0.8rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                      <div style={{ width: "26px", height: "26px", borderRadius: "50%", background: G.btnPrimary, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: "0.75rem", fontWeight: 700 }}>{user.name?.[0]?.toUpperCase()}</div>
                      <span style={{ color: G.textDark, fontSize: "0.8rem", fontWeight: 600, maxWidth: "90px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.name}</span>
                    </div>
                    <button onClick={logout} style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: "10px", padding: "0.5rem 0.7rem", color: "#ef4444", cursor: "pointer", fontSize: "0.75rem", fontWeight: 600 }}>Sign out</button>
                  </div>
                : <button onClick={() => setAuthOpen(true)} style={{ background: G.btnPrimary, color: "#fff", border: "none", borderRadius: "12px", padding: "0.6rem 1.1rem", cursor: "pointer", fontSize: "0.84rem", fontWeight: 700, boxShadow: "0 3px 12px rgba(59,130,246,0.35)" }}>Sign In</button>
              }
            </div>
          </nav>

          {/* ── Hero ── */}
          <div style={{ padding: "4rem 2rem 3rem", textAlign: "center", position: "relative" }}>
            <div style={{ position: "absolute", top: "20px", left: "10%", width: "160px", height: "160px", borderRadius: "50%", background: "rgba(191,219,254,0.4)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.6)", pointerEvents: "none" }} />
            <div style={{ position: "absolute", bottom: "0", right: "8%", width: "110px", height: "110px", borderRadius: "50%", background: "rgba(147,197,253,0.35)", backdropFilter: "blur(16px)", border: "1px solid rgba(255,255,255,0.5)", pointerEvents: "none" }} />
            <div style={{ position: "relative" }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", background: "rgba(255,255,255,0.55)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.8)", borderRadius: "20px", padding: "0.4rem 1rem", marginBottom: "1.25rem", color: G.blue600, fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", fontFamily: "'DM Mono',monospace" }}>
                ● The Future of Automation
              </div>
              <h1 style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 800, fontSize: "clamp(2rem,5vw,3.6rem)", lineHeight: 1.1, color: G.textDark, marginBottom: "1rem", letterSpacing: "-0.03em" }}>
                Professional Robotics<br />
                <span style={{ background: "linear-gradient(135deg,#3b82f6,#1d4ed8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Hardware & Components</span>
              </h1>
              <p style={{ color: G.textMid, fontSize: "0.95rem", maxWidth: "480px", margin: "0 auto 1.75rem", lineHeight: 1.7 }}>
                {isSeller ? "Manage your listings and reach thousands of robotics engineers worldwide." : "Industrial-grade robotic systems, sensors, and controllers for engineers and researchers."}
              </p>
              {isSeller
                ? <PrimaryBtn onClick={() => setAddProductOpen(true)} variant="seller" style={{ padding: "0.85rem 2rem" }}>+ List Your Product</PrimaryBtn>
                : !user && <PrimaryBtn onClick={() => setAuthOpen(true)} style={{ padding: "0.85rem 2rem" }}>Get Started Free →</PrimaryBtn>
              }
            </div>
          </div>

          {/* ── Category + Sort bar ── */}
          <div style={{ padding: "0.9rem 1.5rem", margin: "0 1.5rem 0.75rem", background: "rgba(255,255,255,0.5)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.75)", borderRadius: "18px", display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center", boxShadow: "0 4px 20px rgba(59,130,246,0.08)" }}>
            {CATEGORIES.map(cat => (
              <button key={cat} onClick={() => setCategory(cat)} style={{ padding: "0.4rem 0.9rem", whiteSpace: "nowrap", background: category === cat ? G.btnPrimary : "rgba(255,255,255,0.5)", color: category === cat ? "#fff" : G.textMid, border: category === cat ? "none" : "1px solid rgba(255,255,255,0.7)", borderRadius: "9px", cursor: "pointer", fontSize: "0.76rem", fontWeight: category === cat ? 700 : 500, boxShadow: category === cat ? "0 3px 12px rgba(59,130,246,0.35)" : "none", transition: "all 0.18s" }}>{cat}</button>
            ))}
            <div style={{ marginLeft: "auto" }}>
              <select value={sort} onChange={e => setSort(e.target.value)} style={{ background: "rgba(255,255,255,0.6)", border: G.border, color: G.textMid, borderRadius: "9px", padding: "0.4rem 0.8rem", fontSize: "0.76rem", outline: "none", cursor: "pointer" }}>
                <option value="default">Sort: Default</option>
                <option value="price-asc">Price ↑</option>
                <option value="price-desc">Price ↓</option>
                <option value="rating">Top Rated</option>
              </select>
            </div>
          </div>

          {/* ── Product Grid ── */}
          <main style={{ maxWidth: "1400px", margin: "0 auto", padding: "1rem 1.5rem 3rem" }}>
            {/* Role notice */}
            {!user && (
              <div style={{ background: "rgba(255,255,255,0.55)", border: "1px solid rgba(59,130,246,0.2)", borderRadius: "14px", padding: "0.75rem 1.25rem", marginBottom: "1.25rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <span style={{ fontSize: "1.1rem" }}>ℹ️</span>
                <span style={{ color: G.textMid, fontSize: "0.82rem" }}>
                  <span style={{ fontWeight: 700 }}>Sign in</span> to add items to cart. <span onClick={() => setAuthOpen(true)} style={{ color: G.blue600, cursor: "pointer", fontWeight: 700, textDecoration: "underline" }}>Create a buyer or seller account →</span>
                </span>
              </div>
            )}
            {isSeller && (
              <div style={{ background: "rgba(14,165,233,0.08)", border: "1px solid rgba(14,165,233,0.25)", borderRadius: "14px", padding: "0.75rem 1.25rem", marginBottom: "1.25rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <span style={{ fontSize: "1.1rem" }}>📦</span>
                <span style={{ color: "#0369a1", fontSize: "0.82rem" }}>You're viewing as a <span style={{ fontWeight: 700 }}>Seller</span>. Purchasing is disabled. Use the dashboard to manage your listings.</span>
              </div>
            )}

            <div style={{ color: G.textFaint, fontSize: "0.72rem", marginBottom: "1.1rem", letterSpacing: "0.08em", fontFamily: "'DM Mono',monospace" }}>
              {filtered.length} product{filtered.length !== 1 ? "s" : ""} found
            </div>

            {loading ? (
              <div style={{ textAlign: "center", padding: "5rem", color: G.textLight }}>
                <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>⚙️</div>
                <p>Loading from Cloudflare D1...</p>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(265px,1fr))", gap: "1.2rem" }}>
                {filtered.map(p => (
                  <ProductCard key={p.id} product={p} onAdd={handleAdd} onView={setViewProduct} onBuyNow={handleBuyNow} userRole={user?.role} />
                ))}
                {filtered.length === 0 && (
                  <div style={{ gridColumn: "1/-1", textAlign: "center", padding: "5rem", color: G.textFaint }}>
                    <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🔍</div>
                    <p>No products match your search.</p>
                  </div>
                )}
              </div>
            )}
          </main>

          {/* ── Footer ── */}
          <footer style={{ borderTop: "1px solid rgba(255,255,255,0.6)", background: "rgba(255,255,255,0.4)", backdropFilter: "blur(20px)", padding: "2rem", textAlign: "center", color: G.textFaint, fontSize: "0.7rem", letterSpacing: "0.1em", fontFamily: "'DM Mono',monospace" }}>
            ROBOMART © {new Date().getFullYear()} · CLOUDFLARE D1 + VERCEL · ALL SYSTEMS NOMINAL
          </footer>
        </div>
      </div>

      {/* ── Overlays ── */}
      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} onSuccess={login} />}
      {cartOpen && <CartDrawer cart={cart} onRemove={remove} onUpdate={update} total={total} onClose={() => setCartOpen(false)} onCheckout={handleCheckout} />}
      {viewProduct && <ProductModal product={viewProduct} onClose={() => setViewProduct(null)} onAdd={handleAdd} onBuyNow={handleBuyNow} userRole={user?.role} />}
      {addProductOpen && <AddProductModal onClose={() => setAddProductOpen(false)} onAdd={handleAddProduct} token={token} user={user} />}
      {dashboardOpen && <SellerDashboard user={user} products={products} onAddProduct={() => { setDashboardOpen(false); setAddProductOpen(true); }} onClose={() => setDashboardOpen(false)} />}

      {/* ── Toasts ── */}
      <div style={{ position: "fixed", bottom: "1.5rem", right: "1.5rem", display: "flex", flexDirection: "column", gap: "0.5rem", zIndex: 2000 }}>
        {toasts.map(t => (
          <div key={t.id} style={{ background: "rgba(255,255,255,0.88)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.9)", borderLeft: `3px solid ${t.type === "warn" ? "#f59e0b" : "#3b82f6"}`, padding: "0.75rem 1.25rem", borderRadius: "14px", color: G.textDark, fontSize: "0.8rem", fontFamily: "'Outfit',sans-serif", maxWidth: "290px", boxShadow: "0 8px 24px rgba(59,130,246,0.18)", animation: "toastIn 0.25s cubic-bezier(0.4,0,0.2,1)" }}>
            {t.type === "warn" ? "⚠️" : "✓"} {t.msg}
          </div>
        ))}
      </div>
      <style>{`@keyframes toastIn { from { opacity:0; transform:translateX(24px); } to { opacity:1; transform:none; } }`}</style>
    </>
  );
}
