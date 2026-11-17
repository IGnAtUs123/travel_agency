import { useEffect } from "react";
import { AuthProvider, useAuth } from "./auth.jsx";
import Layout from "./components/Layout.jsx";
import { Loading } from "./components/ui.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import ProfilePage from "./pages/ProfilePage.jsx";
import RegisterPage from "./pages/RegisterPage.jsx";
import TourFormPage from "./pages/TourFormPage.jsx";
import TourPage from "./pages/TourPage.jsx";
import TourRequestsPage from "./pages/TourRequestsPage.jsx";
import ToursListPage from "./pages/ToursListPage.jsx";
import { Link, Router, navigate } from "./router.jsx";

const routes = [
  { path: "/", element: () => <ToursListPage /> },
  { path: "/tours/:id", element: (p) => <TourPage id={p.id} /> },
  { path: "/login", element: () => <LoginPage /> },
  { path: "/register", element: () => <RegisterPage /> },
  { path: "/profile", element: () => <Redirect to="/profile/bookings" /> },
  { path: "/profile/bookings", element: () => <ProfilePage tab="bookings" /> },
  { path: "/profile/tours", element: () => <ProfilePage tab="tours" /> },
  { path: "/profile/info", element: () => <ProfilePage tab="info" /> },
  { path: "/admin/tours/new", element: () => <TourFormPage /> },
  {
    path: "/admin/tours/:id/edit",
    element: (p) => <TourFormPage tourId={p.id} />,
  },
  {
    path: "/admin/tours/:id/requests",
    element: (p) => <TourRequestsPage tourId={p.id} />,
  },
];

function Redirect({ to }) {
  useEffect(() => {
    navigate(to, { replace: true });
  }, [to]);
  return null;
}

function NotFound() {
  return (
    <Layout>
      <h1 className="page-title">Страница не найдена</h1>
      <p className="center">
        <Link to="/" className="btn">
          На главную
        </Link>
      </p>
    </Layout>
  );
}

function Routes() {
  const { user } = useAuth();
  if (user === undefined) return <Loading />;
  return <Router routes={routes} notFound={<NotFound />} />;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes />
    </AuthProvider>
  );
}
