import { useEffect, useState } from "react";
import { api } from "../api.js";
import Layout from "../components/Layout.jsx";
import { Alert, FlashMessage, Loading } from "../components/ui.jsx";
import { Link } from "../router.jsx";
import { formatDate, formatPrice } from "../util.js";

const DURATIONS = [
  { value: "", label: "Любая", min: "", max: "" },
  { value: "1-3", label: "1–3 дня", min: 1, max: 3 },
  { value: "4-7", label: "4–7 дней", min: 4, max: 7 },
  { value: "8-14", label: "8–14 дней", min: 8, max: 14 },
  { value: "15+", label: "Более 14 дней", min: 15, max: "" },
];

export function TourCard({ tour }) {
  return (
    <Link
      to={`/tours/${tour.id}`}
      className="tour-card"
      data-testid="tour-card"
    >
      {tour.cover ? (
        <img src={tour.cover} alt={tour.title} />
      ) : (
        <div className="tour-card-noimg">Нет фото</div>
      )}
      <div className="tour-card-body">
        <h3>{tour.title}</h3>
        <p>Цена: {formatPrice(tour.price)}</p>
        <p>Дата: {formatDate(tour.startDate)}</p>
        <p>Кол-во дней: {tour.durationDays}</p>
        <p>Сложность: {tour.difficulty.name}</p>
        <p>Сезон: {tour.season.name}</p>
      </div>
    </Link>
  );
}

export default function ToursListPage() {
  const [dict, setDict] = useState({ difficulties: [], seasons: [] });
  const [form, setForm] = useState({
    search: "",
    difficulty: "",
    duration: "",
    season: "",
  });
  const [state, setState] = useState({ loading: true, tours: [], error: null });

  const load = async (f) => {
    const d = DURATIONS.find((x) => x.value === f.duration) ?? DURATIONS[0];
    const q = new URLSearchParams();
    if (f.search.trim()) q.set("search", f.search.trim());
    if (f.difficulty) q.set("difficulty", f.difficulty);
    if (f.season) q.set("season", f.season);
    if (d.min) q.set("minDays", d.min);
    if (d.max) q.set("maxDays", d.max);
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await api.get(`/api/tours?${q}`);
      setState({ loading: false, tours: data.tours, error: null });
    } catch (e) {
      setState({ loading: false, tours: [], error: e.message });
    }
  };

  useEffect(() => {
    api
      .get("/api/dictionaries")
      .then(setDict)
      .catch(() => {});
    load(form);
  }, []);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const submit = (e) => {
    e.preventDefault();
    load(form);
  };

  return (
    <Layout wide>
      <FlashMessage />
      <form className="filters" onSubmit={submit}>
        <input
          type="search"
          placeholder="Поиск туров"
          value={form.search}
          onChange={set("search")}
          aria-label="Поиск туров"
        />
        <select
          value={form.difficulty}
          onChange={set("difficulty")}
          aria-label="Сложность"
        >
          <option value="">Сложность</option>
          {dict.difficulties.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        <select
          value={form.duration}
          onChange={set("duration")}
          aria-label="Длительность"
        >
          <option value="">Длительность</option>
          {DURATIONS.slice(1).map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </select>
        <select value={form.season} onChange={set("season")} aria-label="Сезон">
          <option value="">Сезон</option>
          {dict.seasons.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <button className="btn" type="submit">
          Найти тур
        </button>
      </form>

      <Alert>{state.error}</Alert>
      {state.loading ? (
        <Loading />
      ) : state.tours.length === 0 && !state.error ? (
        <p className="muted center">Туры не найдены</p>
      ) : (
        <div className="tour-grid">
          {state.tours.map((t) => (
            <TourCard key={t.id} tour={t} />
          ))}
        </div>
      )}
    </Layout>
  );
}
