
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  NavLink,
  Navigate,
  Outlet,
  Route,
  Routes,
  useNavigate,
} from "react-router-dom";
import "./App.css";

const API = "https://taskflow-backend-g7s2.onrender.com/api/tasks";
const AUTH_API = "https://taskflow-backend-g7s2.onrender.com/api/auth";
const USER_KEY = "taskflow_user";
const TOKEN_KEY = "taskflow_token";
const HISTORY_KEY = "taskflow_activity_history";
const THEME_KEY = "taskflow_theme";

const emptyForm = {
  title: "",
  description: "",
  priority: "medium",
  dueDate: "",
};

function readJSON(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || "null") ?? fallback;
  } catch {
    return fallback;
  }
}

function App() {
  const [token, setToken] = useState(
    () => localStorage.getItem(TOKEN_KEY) || ""
  );

  const [user, setUser] = useState(() => readJSON(USER_KEY, null));
  const [tasks, setTasks] = useState([]);
  const [activities, setActivities] = useState(
    () => readJSON(HISTORY_KEY, [])
  );

  const [theme, setTheme] = useState(
    () => localStorage.getItem(THEME_KEY) || "dark"
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  const navigate = useNavigate();

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    if (!toast) return;

    const timer = window.setTimeout(() => setToast(""), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);

    setToken("");
    setUser(null);
    setTasks([]);
    setError("");
    navigate("/login");
  }, [navigate]);

  const apiRequest = useCallback(
    async (url, options = {}) => {
      const response = await fetch(url, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          ...(token
            ? { Authorization: `Bearer ${token}` }
            : {}),
          ...options.headers,
        },
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.message || `Request failed (${response.status})`
        );
      }

      return data;
    },
    [token]
  );

  const loadTasks = useCallback(async () => {
    if (!token) {
      setTasks([]);
      return;
    }

    setLoading(true);

    try {
      const result = await apiRequest(
        `${API}?limit=100&page=1`
      );

      setTasks(
        Array.isArray(result.data) ? result.data : []
      );

      setError("");
    } catch (err) {
      setError(err.message);

      if (/token|authorized|expired/i.test(err.message)) {
        logout();
      }
    } finally {
      setLoading(false);
    }
  }, [apiRequest, token, logout]);

  useEffect(() => {
    if (token) loadTasks();
  }, [token, loadTasks]);

  const addActivity = (type, title, description) => {
    const next = [
      {
        id: `${Date.now()}-${Math.random()}`,
        type,
        title,
        description,
        time: new Date().toISOString(),
      },
      ...activities,
    ].slice(0, 100);

    setActivities(next);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  };

  async function authenticate(mode, form) {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${AUTH_API}/${mode}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          result.message || "Authentication failed"
        );
      }

      if (!result.token) {
        throw new Error(
          "The server did not return an authentication token."
        );
      }

      localStorage.setItem(TOKEN_KEY, result.token);
      localStorage.setItem(
        USER_KEY,
        JSON.stringify(result.user || null)
      );

      setToken(result.token);
      setUser(result.user || null);

      setToast(
        mode === "login"
          ? "Welcome back to TaskFlow"
          : "Your account was created"
      );

      navigate("/dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function saveTask(form, editingId) {
    const payload = {
      ...form,
      title: form.title.trim(),
      description: form.description.trim(),
    };

    if (!payload.dueDate) {
      delete payload.dueDate;
    }

    const editing = Boolean(editingId);

    await apiRequest(
      editing ? `${API}/${editingId}` : API,
      {
        method: editing ? "PUT" : "POST",
        body: JSON.stringify(payload),
      }
    );

    addActivity(
      editing ? "updated" : "added",
      payload.title,
      editing
        ? "You updated this mission."
        : "You created a new mission."
    );

    await loadTasks();

    setToast(
      editing ? "Mission updated" : "New mission added"
    );
  }

  async function toggleTask(task) {
    const completed = task.status !== "completed";

    await apiRequest(`${API}/${task._id}`, {
      method: "PUT",
      body: JSON.stringify({
        status: completed ? "completed" : "pending",
      }),
    });

    addActivity(
      completed ? "completed" : "reopened",
      task.title,
      completed
        ? "You completed this mission."
        : "You reopened this mission."
    );

    await loadTasks();

    setToast(
      completed ? "Mission completed" : "Mission reopened"
    );
  }

  async function deleteTask(task) {
    if (!window.confirm(`Delete "${task.title}"?`)) return;

    await apiRequest(`${API}/${task._id}`, {
      method: "DELETE",
    });

    addActivity(
      "deleted",
      task.title,
      "You removed this mission from your workspace."
    );

    await loadTasks();
    setToast("Mission deleted");
  }

  const shared = {
    user,
    tasks,
    activities,
    loading,
    error,
    setError,
    theme,
    setTheme,
    loadTasks,
    saveTask,
    toggleTask,
    deleteTask,
    setActivities,
    addActivity,
    logout,
  };

  return (
    <div className="app-root">
      <Routes>
        <Route
          path="/login"
          element={
            token ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <AuthPage
                authenticate={authenticate}
                loading={loading}
                error={error}
              />
            )
          }
        />

        <Route
          path="/register"
          element={
            token ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <AuthPage
                register
                authenticate={authenticate}
                loading={loading}
                error={error}
              />
            )
          }
        />

        <Route
          element={
            token ? (
              <AppLayout {...shared} />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        >
          <Route
            index
            element={<Navigate to="/dashboard" replace />}
          />

          <Route
            path="dashboard"
            element={<DashboardPage {...shared} />}
          />

          <Route
            path="tasks"
            element={<TasksPage {...shared} />}
          />

          <Route
            path="calendar"
            element={<CalendarPage {...shared} />}
          />

          <Route
            path="activity"
            element={<ActivityPage {...shared} />}
          />

          <Route
            path="profile"
            element={<ProfilePage {...shared} />}
          />

          <Route
            path="settings"
            element={<SettingsPage {...shared} />}
          />
        </Route>

        <Route
          path="*"
          element={
            <Navigate
              to={token ? "/dashboard" : "/login"}
              replace
            />
          }
        />
      </Routes>

      {token && (
        <footer className="app-footer">
          <p>TaskFlow © 2026 | Built with MERN Stack</p>
          <p>Designed & Developed by <strong>Febin U</strong></p>
          <span>BUILD YOUR GOALS. COMPLETE YOUR MISSIONS.</span>
        </footer>
      )}

      {toast && (
        <div className="toast" role="status">
          ✓ {toast}
        </div>
      )}
    </div>
  );
}

function AuthPage({
  register = false,
  authenticate,
  loading,
  error,
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const submit = (e) => {
    e.preventDefault();

    authenticate(
      register ? "register" : "login",
      register
        ? { name, email, password }
        : { email, password }
    );
  };

  return (
    <main className="auth-screen">
      <form
        className="auth-card panel"
        onSubmit={submit}
      >
        <div className="brand-mark">T</div>

        <p className="eyebrow">
          YOUR PERSONAL PRODUCTIVITY SPACE
        </p>

        <h1>
          {register
            ? "Create your account"
            : "Welcome to TaskFlow"}
        </h1>

        <p className="muted">
          Your goals. Your missions. Your success.
        </p>

        {register && (
          <label>
            Full name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Your name"
            />
          </label>
        )}

        <label>
          Email address
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="you@example.com"
          />
        </label>

        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength="6"
            required
            placeholder="At least 6 characters"
          />
        </label>

        {error && (
          <p className="error-text">{error}</p>
        )}

        <button
          className="btn primary full"
          disabled={loading}
        >
          {loading
            ? "Please wait…"
            : register
              ? "Create account"
              : "Sign in to TaskFlow"}
        </button>

        <p className="auth-switch">
          {register
            ? "Already have an account? "
            : "New to TaskFlow? "}

          <NavLink
            to={register ? "/login" : "/register"}
          >
            {register ? "Sign in" : "Create an account"}
          </NavLink>
        </p>
      </form>
    </main>
  );
}

const navItems = [
  ["/dashboard", "▦", "Dashboard"],
  ["/tasks", "☷", "My Tasks"],
  ["/calendar", "▦", "Calendar"],
  ["/activity", "◷", "Activity"],
  ["/profile", "◉", "Profile"],
  ["/settings", "⚙", "Settings"],
];

function AppLayout({
  user,
  tasks,
  loading,
  error,
  theme,
  setTheme,
  logout,
}) {
  const name = user?.name || "TaskFlow Member";

  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((x) => x[0])
    .join("")
    .toUpperCase();

  const dueSoon = tasks.filter(
    (task) =>
      task.status !== "completed" &&
      task.dueDate &&
      new Date(task.dueDate) <=
      new Date(Date.now() + 86400000 * 2)
  ).length;

  return (
    <div className="layout">
      <aside className="sidebar">
        <NavLink to="/dashboard" className="brand">
          <span className="brand-mark small">T</span>
          <span>TaskFlow</span>
        </NavLink>

        <p className="side-label">WORKSPACE</p>

        <nav>
          {navItems.map(([to, icon, label]) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `nav-link ${isActive ? "active" : ""}`
              }
            >
              <span className="nav-icon">{icon}</span>
              {label}

              {label === "Calendar" && dueSoon > 0 && (
                <b className="nav-count">{dueSoon}</b>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="mini-profile">
            <span className="avatar">{initials}</span>

            <span>
              <b>{name}</b>
              <small>{user?.email || "Account"}</small>
            </span>
          </div>

          <button
            className="nav-link logout-link"
            onClick={logout}
          >
            ↗ <span>Log out</span>
          </button>
        </div>
      </aside>

      <section className="main-area">
        <header className="topbar">
          <div>
            <span className="eyebrow">
              YOUR PRODUCTIVITY SPACE
            </span>
            <h2>Make progress, every day.</h2>
          </div>

          <div className="top-actions">
            <button
              className="icon-btn"
              title="Toggle theme"
              onClick={() =>
                setTheme(
                  theme === "dark" ? "light" : "dark"
                )
              }
            >
              {theme === "dark" ? "☼" : "☾"}
            </button>

            <span className="avatar">{initials}</span>
          </div>
        </header>

        {error && (
          <div className="notice error-text">{error}</div>
        )}

        {loading && (
          <div className="loading-line">
            Syncing your workspace…
          </div>
        )}

        <div className="page-content">
          <Outlet />
        </div>
      </section>
    </div>
  );
}

function PageHeading({
  eyebrow = "OVERVIEW",
  title,
  subtitle,
  action,
}) {
  return (
    <div className="page-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}


function StatCard({ label, value, note, icon }) {
  return (
    <article className="stat-card panel">
      <div className="stat-card-heading">
        <p>{label}</p>
        <span className="stat-icon">{icon}</span>
      </div>
      <strong>{value}</strong>
      <small>{note}</small>
    </article>
  );
}

function DashboardPage({ user, tasks, activities }) {
  const completed = tasks.filter(
    (task) => task.status === "completed"
  ).length;

  const active = tasks.length - completed;

  const progress = tasks.length
    ? Math.round((completed / tasks.length) * 100)
    : 0;

  const recent = activities.slice(0, 5);

  return (
    <>
      <PageHeading
        title={`Welcome back, ${user?.name?.split(" ")[0] || "there"
          }.`}
        subtitle="Here's your productivity overview."
      />

      <section className="stats-grid">
        <StatCard
          label="Total missions"
          value={tasks.length}
          note="All your tasks"
          icon="▦"
        />

        <StatCard
          label="Active missions"
          value={active}
          note="Still in progress"
          icon="◷"
        />

        <StatCard
          label="Completed"
          value={completed}
          note="Successfully achieved"
          icon="✓"
        />

        <StatCard
          label="Completion"
          value={`${progress}%`}
          note="Your overall progress"
          icon="↗"
        />
      </section>

      <section className="panel progress-panel">
        <div className="section-title">
          <div>
            <p className="eyebrow">YOUR MOMENTUM</p>
            <h2>Mission progress</h2>
          </div>
          <strong>{progress}%</strong>
        </div>

        <div className="progress-track">
          <span style={{ width: `${progress}%` }} />
        </div>

        <p className="muted">
          {completed} of {tasks.length} missions completed.
          Keep moving forward.
        </p>
      </section>

      <section className="panel">
        <div className="section-title">
          <div>
            <p className="eyebrow">RECENT ACTIONS</p>
            <h2>Activity history</h2>
          </div>

          <NavLink className="text-link" to="/activity">
            View all →
          </NavLink>
        </div>

        {recent.length ? (
          <ActivityList items={recent} />
        ) : (
          <EmptyState
            title="No activity yet"
            text="Your task actions will appear here."
          />
        )}
      </section>

      <section className="panel quick-panel">
        <div>
          <p className="eyebrow">READY FOR THE NEXT STEP?</p>
          <h2>Turn your plans into progress.</h2>
          <p className="muted">
            Create a mission and keep your day moving.
          </p>
        </div>

        <NavLink to="/tasks" className="btn primary">
          Manage my tasks →
        </NavLink>
      </section>
    </>
  );
}

function TasksPage({
  tasks,
  saveTask,
  toggleTask,
  deleteTask,
  loading,
}) {
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("createdAt");
  const [localError, setLocalError] = useState("");

  const filtered = useMemo(() => {
    return tasks
      .filter((task) =>
        (task.title || "")
          .toLowerCase()
          .includes(search.toLowerCase())
      )
      .filter(
        (task) =>
          filter === "all" ||
          (filter === "completed"
            ? task.status === "completed"
            : task.status !== "completed")
      )
      .sort((a, b) => {
        if (sort === "title") {
          return a.title.localeCompare(b.title);
        }

        if (sort === "dueDate") {
          return (
            new Date(a.dueDate || "9999-12-31") -
            new Date(b.dueDate || "9999-12-31")
          );
        }

        return (
          new Date(b.createdAt || 0) -
          new Date(a.createdAt || 0)
        );
      });
  }, [tasks, search, filter, sort]);

  async function submit(e) {
    e.preventDefault();

    try {
      setLocalError("");
      await saveTask(form, editingId);
      setForm(emptyForm);
      setEditingId(null);
    } catch (err) {
      setLocalError(err.message);
    }
  }

  function edit(task) {
    setEditingId(task._id);

    setForm({
      title: task.title || "",
      description: task.description || "",
      priority: task.priority || "medium",
      dueDate: task.dueDate
        ? new Date(task.dueDate).toISOString().slice(0, 10)
        : "",
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <>
      <PageHeading
        title="My tasks"
        subtitle="Plan, prioritize and complete your missions."
      />

      <section className="panel task-form-panel">
        <div className="section-title">
          <div>
            <p className="eyebrow">
              {editingId ? "UPDATE MISSION" : "PLAN YOUR SUCCESS"}
            </p>
            <h2>
              {editingId
                ? "Edit mission"
                : "Create a new mission"}
            </h2>
          </div>
        </div>

        <form onSubmit={submit} className="task-form">
          <input
            placeholder="Task title"
            value={form.title}
            onChange={(e) =>
              setForm({ ...form, title: e.target.value })
            }
            required
          />

          <textarea
            placeholder="Description (optional)"
            rows="2"
            value={form.description}
            onChange={(e) =>
              setForm({
                ...form,
                description: e.target.value,
              })
            }
          />

          <div className="form-row">
            <select
              value={form.priority}
              onChange={(e) =>
                setForm({
                  ...form,
                  priority: e.target.value,
                })
              }
            >
              <option value="low">Low priority</option>
              <option value="medium">Medium priority</option>
              <option value="high">High priority</option>
            </select>

            <input
              type="date"
              value={form.dueDate}
              onChange={(e) =>
                setForm({
                  ...form,
                  dueDate: e.target.value,
                })
              }
            />
          </div>

          {localError && (
            <p className="error-text">{localError}</p>
          )}

          <div className="button-row">
            <button className="btn primary">
              {editingId ? "Save changes" : "+ Add mission"}
            </button>

            {editingId && (
              <button
                type="button"
                className="btn secondary"
                onClick={() => {
                  setEditingId(null);
                  setForm(emptyForm);
                }}
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="panel">
        <div className="section-title">
          <div>
            <p className="eyebrow">YOUR DAILY GOALS</p>
            <h2>{filtered.length} missions</h2>
          </div>
        </div>

        <div className="toolbar">
          <input
            placeholder="Search missions…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">All tasks</option>
            <option value="pending">Active</option>
            <option value="completed">Completed</option>
          </select>

          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="createdAt">Newest</option>
            <option value="dueDate">Due date</option>
            <option value="title">Title A–Z</option>
          </select>
        </div>

        {loading ? (
          <EmptyState
            title="Loading tasks…"
            text="Syncing with your account."
          />
        ) : filtered.length ? (
          <div className="task-list">
            {filtered.map((task) => (
              <TaskItem
                key={task._id}
                task={task}
                onToggle={() => toggleTask(task)}
                onEdit={() => edit(task)}
                onDelete={() => deleteTask(task)}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            title="No missions found"
            text="Create a task above or change your filters."
          />
        )}
      </section>
    </>
  );
}

function TaskItem({ task, onToggle, onEdit, onDelete }) {
  return (
    <article
      className={`task-item ${task.status === "completed" ? "is-done" : ""
        }`}
    >
      <button
        className={`check-button ${task.status === "completed" ? "checked" : ""
          }`}
        onClick={onToggle}
        aria-label="Toggle task"
      >
        {task.status === "completed" ? "✓" : ""}
      </button>

      <div className="task-copy">
        <h3>{task.title}</h3>

        <p>{task.description || "No description added."}</p>

        <div className="chips">
          <span className={`chip priority-${task.priority}`}>
            {task.priority || "medium"} priority
          </span>

          <span className="chip">
            {task.status || "pending"}
          </span>

          {task.dueDate && (
            <span className="chip">
              Due {new Date(task.dueDate).toLocaleDateString()}
            </span>
          )}
        </div>
      </div>

      <div className="item-actions">
        <button
          className="btn secondary small"
          onClick={onEdit}
        >
          Edit
        </button>

        <button
          className="btn danger small"
          onClick={onDelete}
        >
          Delete
        </button>
      </div>
    </article>
  );
}

function CalendarPage({ tasks }) {
  const dated = tasks
    .filter((task) => task.dueDate)
    .sort(
      (a, b) => new Date(a.dueDate) - new Date(b.dueDate)
    );

  const overdue = dated.filter(
    (task) =>
      task.status !== "completed" &&
      new Date(task.dueDate) <
      new Date(new Date().toDateString())
  );

  const upcoming = dated.filter(
    (task) => !overdue.includes(task)
  );

  return (
    <>
      <PageHeading
        title="Calendar"
        subtitle="Keep an eye on deadlines and upcoming missions."
      />

      <div className="stats-grid compact">
        <StatCard
          label="With due dates"
          value={dated.length}
          note="Scheduled missions"
          icon="▦"
        />

        <StatCard
          label="Overdue"
          value={overdue.length}
          note="Need your attention"
          icon="!"
        />

        <StatCard
          label="Upcoming"
          value={upcoming.length}
          note="Future deadlines"
          icon="◷"
        />
      </div>

      <section className="panel">
        <p className="eyebrow">DEADLINE TIMELINE</p>
        <h2>Scheduled missions</h2>

        {dated.length ? (
          <div className="timeline">
            {dated.map((task) => (
              <div className="timeline-item" key={task._id}>
                <time>
                  {new Date(task.dueDate).toLocaleDateString(
                    undefined,
                    {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    }
                  )}
                </time>

                <div>
                  <b>{task.title}</b>

                  <p className="muted">
                    {task.status === "completed"
                      ? "Completed"
                      : overdue.includes(task)
                        ? "Overdue"
                        : "Upcoming"}
                    {" · "}
                    {task.priority} priority
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No deadlines yet"
            text="Add a due date to a task to see it here."
          />
        )}
      </section>
    </>
  );
}

function ActivityPage({ activities, setActivities }) {
  function clear() {
    if (!window.confirm("Clear all activity history?")) {
      return;
    }

    setActivities([]);
    localStorage.removeItem(HISTORY_KEY);
  }

  return (
    <>
      <PageHeading
        title="Activity"
        subtitle="A record of the work you've done."
        action={
          <button
            className="btn secondary"
            disabled={!activities.length}
            onClick={clear}
          >
            Clear history
          </button>
        }
      />

      <section className="panel">
        {activities.length ? (
          <ActivityList items={activities} />
        ) : (
          <EmptyState
            title="No activity yet"
            text="Add, update or complete a task to build your history."
          />
        )}
      </section>
    </>
  );
}

function ActivityList({ items }) {
  const icons = {
    added: "＋",
    updated: "✎",
    completed: "✓",
    reopened: "↻",
    deleted: "×",
  };

  return (
    <div className="activity-list">
      {items.map((activity) => (
        <article className="activity-item" key={activity.id}>
          <span
            className={`activity-icon ${activity.type}`}
          >
            {icons[activity.type] || "·"}
          </span>

          <div className="activity-copy">
            <b>{activity.title}</b>
            <p>{activity.description}</p>
            <small>
              {new Date(activity.time).toLocaleString()}
            </small>
          </div>

          <span className={`activity-tag ${activity.type}`}>
            {activity.type}
          </span>
        </article>
      ))}
    </div>
  );
}

function ProfilePage({ user, tasks }) {
  const name = user?.name || "TaskFlow Member";

  const initials = name
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <>
      <PageHeading
        title="Your profile"
        subtitle="Your account at a glance."
      />

      <section className="panel profile-panel">
        <span className="profile-avatar">{initials}</span>

        <div>
          <p className="eyebrow">TASKFLOW MEMBER</p>
          <h2>{name}</h2>
          <p className="muted">
            {user?.email || "Email unavailable"}
          </p>
          <span className="status-pill">
            ● Account connected
          </span>
        </div>
      </section>

      <div className="stats-grid compact">
        <StatCard
          label="Total missions"
          value={tasks.length}
          note="In your workspace"
          icon="▦"
        />

        <StatCard
          label="Completed"
          value={
            tasks.filter(
              (task) => task.status === "completed"
            ).length
          }
          note="Achievements"
          icon="✓"
        />
      </div>
    </>
  );
}

function SettingsPage({ theme, setTheme }) {
  return (
    <>
      <PageHeading
        title="Settings"
        subtitle="Make TaskFlow comfortable for your workflow."
      />

      <section className="panel settings-row">
        <div>
          <h3>Appearance</h3>
          <p className="muted">
            Choose your preferred theme.
          </p>
        </div>

        <div className="button-row">
          <button
            className={`btn ${theme === "dark" ? "primary" : "secondary"
              }`}
            onClick={() => setTheme("dark")}
          >
            Dark mode
          </button>

          <button
            className={`btn ${theme === "light" ? "primary" : "secondary"
              }`}
            onClick={() => setTheme("light")}
          >
            Light mode
          </button>
        </div>
      </section>

      <section className="panel settings-row">
        <div>
          <h3>Notifications</h3>
          <p className="muted">
            Upcoming and overdue deadlines are highlighted
            in Calendar.
          </p>
        </div>

        <span className="status-pill">
          Enabled in app
        </span>
      </section>
    </>
  );
}

function EmptyState({ title, text }) {
  return (
    <div className="empty-state">
      <span>✦</span>
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}
<footer className="app-footer">
  <p>TaskFlow © 2026 | Built with MERN Stack</p>
  <p>Designed & Developed by <strong>Febin U</strong></p>
  <span>BUILD YOUR GOALS. COMPLETE YOUR MISSIONS.</span>
</footer>

export default App;