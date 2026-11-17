import { useEffect, useState } from "react";
import { takeFlash } from "../util.js";

export function Field({ label, error, children }) {
  return (
    <label className={error ? "field invalid" : "field"}>
      <span className="field-label">{label}</span>
      {children}
      {typeof error === "string" && (
        <span className="field-error">{error}</span>
      )}
    </label>
  );
}

export function Alert({ kind = "error", children }) {
  if (!children) return null;
  return (
    <div
      className={`alert alert-${kind}`}
      role={kind === "error" ? "alert" : "status"}
    >
      {children}
    </div>
  );
}

export function FlashMessage() {
  const [msg, setMsg] = useState(null);
  useEffect(() => {
    setMsg(takeFlash());
  }, []);
  return <Alert kind="success">{msg}</Alert>;
}

export function Loading() {
  return <p className="muted center">Загрузка…</p>;
}

export function useLoad(loader, deps = []) {
  const [state, setState] = useState({
    loading: true,
    data: null,
    error: null,
  });
  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    loader()
      .then((data) => alive && setState({ loading: false, data, error: null }))
      .catch(
        (error) => alive && setState({ loading: false, data: null, error }),
      );
    return () => {
      alive = false;
    };
  }, deps);
  return [state, setState];
}
