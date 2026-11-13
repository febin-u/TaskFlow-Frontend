
import { useEffect, useState } from "react";
import "./App.css";

const API = "http://localhost:5001/api/tasks";
const AUTH_API = "http://localhost:5001/api/auth";
const HISTORY_KEY = "taskflow_activity_history";
const USER_KEY = "taskflow_user";

const emptyForm = {
  title: "",
  description: "",
  priority: "medium",
  dueDate: "",
};

function App() {
  const [token, setToken] = useState(
    localStorage.getItem("taskflow_token") || ""
  );

  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(USER_KEY) || "null");
    } catch {
      return null;
    }
  });

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tokenInput, setTokenInput] = useState("");
  const [authMode, setAuthMode] = useState("login");

  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [editingId, setEditingId] = useState(null);
  const [toast, setToast] = useState(null);

  const [activities, setActivities] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    } catch {
      return [];
    }
  });

  const [mission, setMission] = useState({
    title: "Ready for your next mission?",
    subtitle: "Every completed task brings you closer to your goals.",
  });

  const [form, setForm] = useState(emptyForm);

  const showMessage = (type, title, subtitle) => {
    setToast({ type, title, subtitle });
    setMission({ title, subtitle });
  };

  const addActivity = (type, title, description) => {
    const activity = {
      id: `${Date.now()}-${Math.random()}`,
      type,
      title,
      description,
      time: new Date().toISOString(),
    };

    setActivities((previous) => {
      const updated = [activity, ...previous].slice(0, 50);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  const clearHistory = () => {
    if (!window.confirm("Clear all activity history?")) return;

    setActivities([]);
    localStorage.removeItem(HISTORY_KEY);

    showMessage(
      "success",
      "HISTORY CLEARED!",
      "Your activity history has been cleared."
    );
  };

  useEffect(() => {
    if (!toast) return;

    const timer = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  const request = async (url, options = {}) => {
    const response = await fetch(url, {
      ...options,
      headers: { ...headers, ...options.headers },
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(result.message || "Something went wrong");
    }

    return result;
  };

  const loadTasks = async () => {
    if (!token) return;

    try {
      setLoading(true);
      setError("");

      const result = await request(API);
      setTasks(Array.isArray(result.data) ? result.data : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, [token]);

  // LOGIN WITH EMAIL AND PASSWORD

  const loginUser = async (e) => {
    e.preventDefault();

    if (!email.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const response = await fetch(`${AUTH_API}/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result.message || "Login failed.");
      }

      if (!result.token) {
        throw new Error("Authentication token was not received.");
      }

      localStorage.setItem("taskflow_token", result.token);
      setToken(result.token);

      if (result.user) {
        localStorage.setItem(USER_KEY, JSON.stringify(result.user));
        setUser(result.user);
      } else {
        localStorage.removeItem(USER_KEY);
        setUser(null);
      }

      setPassword("");
      setEmail("");

      showMessage(
        "success",
        "WELCOME TO TASKFLOW!",
        `Welcome back, ${result.user?.name || "developer"}!`
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // CONNECT USING EXISTING JWT TOKEN

  const saveToken = () => {
    const value = tokenInput.trim();

    if (!value) {
      setError("Please enter your JWT token.");
      return;
    }

    localStorage.setItem("taskflow_token", value);
    localStorage.removeItem(USER_KEY);

    setUser(null);
    setToken(value);
    setTokenInput("");
    setError("");
  };

  const logout = () => {
    localStorage.removeItem("taskflow_token");
    localStorage.removeItem(USER_KEY);

    setToken("");
    setUser(null);
    setTasks([]);
    setToast(null);
    setError("");
    setForm(emptyForm);
    setEditingId(null);
  };

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  // CREATE AND UPDATE TASKS

  const saveTask = async (e) => {
    e.preventDefault();

    if (!form.title.trim()) return;

    const isEditing = Boolean(editingId);
    const taskTitle = form.title.trim();

    try {
      setLoading(true);
      setError("");

      const payload = {
        ...form,
        title: taskTitle,
        description: form.description.trim(),
      };

      if (!payload.dueDate) delete payload.dueDate;

      if (isEditing) {
        await request(`${API}/${editingId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      } else {
        await request(API, {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }

      addActivity(
        isEditing ? "updated" : "added",
        taskTitle,
        isEditing
          ? "You updated this mission."
          : "You created a new mission."
      );

      setForm(emptyForm);
      setEditingId(null);

      await loadTasks();

      showMessage(
        "success",
        isEditing ? "MISSION UPDATED!" : "NEW MISSION ADDED!",
        isEditing
          ? "Your changes have been saved successfully."
          : "Great start! One more step towards productivity."
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const editTask = (task) => {
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
  };

  const deleteTask = async (id) => {
    if (!window.confirm("Are you sure you want to delete this task?")) {
      return;
    }

    const task = tasks.find((item) => item._id === id);
    const taskTitle = task?.title || "Untitled mission";

    try {
      setError("");

      await request(`${API}/${id}`, {
        method: "DELETE",
      });

      addActivity(
        "deleted",
        taskTitle,
        "You removed this mission from your workspace."
      );

      await loadTasks();

      showMessage(
        "success",
        "MISSION REMOVED!",
        "The task has been successfully removed."
      );
    } catch (err) {
      setError(err.message);
    }
  };

  const toggleTask = async (task) => {
    const completing = task.status !== "completed";

    try {
      setError("");

      await request(`${API}/${task._id}`, {
        method: "PUT",
        body: JSON.stringify({
          status: completing ? "completed" : "pending",
        }),
      });

      addActivity(
        completing ? "completed" : "reopened",
        task.title,
        completing
          ? "You successfully completed this mission."
          : "You moved this mission back to active tasks."
      );

      await loadTasks();

      showMessage(
        "success",
        completing ? "MISSION COMPLETED!" : "MISSION REOPENED!",
        completing
          ? "Excellent work! Keep your momentum going."
          : "Your task is back on your active mission list."
      );
    } catch (err) {
      setError(err.message);
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(emptyForm);
  };

  const filteredTasks = tasks.filter((task) => {
    const matchesSearch = (task.title || "")
      .toLowerCase()
      .includes(search.toLowerCase());

    const matchesFilter =
      filter === "all" ||
      (filter === "completed" && task.status === "completed") ||
      (filter === "pending" && task.status !== "completed");

    return matchesSearch && matchesFilter;
  });

  const completed = tasks.filter(
    (task) => task.status === "completed"
  ).length;

  const pending = tasks.length - completed;

  const progress = tasks.length
    ? Math.round((completed / tasks.length) * 100)
    : 0;

  const formatActivityTime = (time) => {
    const date = new Date(time);

    if (Number.isNaN(date.getTime())) return "Unknown date";

    return date.toLocaleString([], {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const activityIcon = {
    added: "＋",
    updated: "✎",
    completed: "✓",
    reopened: "↻",
    deleted: "×",
  };

  const displayName = user?.name || "TaskFlow Member";
  const displayEmail = user?.email || "Profile details unavailable";
  const initials = user?.name
    ? user.name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase()
    : "T";

  // LOGIN SCREEN

  if (!token) {
    return (
      <div className="login-screen">
        <div className="login-card glass">
          <div className="logo">T</div>

          <p className="eyebrow">YOUR PERSONAL PRODUCTIVITY SPACE</p>
          <h1>Welcome to TaskFlow</h1>

          <p className="login-subtitle">
            Your goals. Your missions. Your success.
          </p>

          <div className="auth-tabs">
            <button
              className={authMode === "login" ? "active" : ""}
              onClick={() => {
                setAuthMode("login");
                setError("");
              }}
            >
              Sign In
            </button>

            <button
              className={authMode === "token" ? "active" : ""}
              onClick={() => {
                setAuthMode("token");
                setError("");
              }}
            >
              Use JWT Token
            </button>
          </div>

          {authMode === "login" ? (
            <form onSubmit={loginUser} className="login-form">
              <label>Email Address</label>

              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
              />

              <label>Password</label>

              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
              />

              {error && <p className="error">{error}</p>}

              <button
                className="primary-btn full-btn"
                type="submit"
                disabled={loading}
              >
                {loading ? "Signing in..." : "Sign In to TaskFlow"}
              </button>
            </form>
          ) : (
            <>
              <label>JWT Access Token</label>

              <textarea
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="Paste your JWT token here..."
              />

              {error && <p className="error">{error}</p>}

              <button
                className="primary-btn full-btn"
                onClick={saveToken}
              >
                Connect to TaskFlow
              </button>
            </>
          )}

          <small>
            Your authentication details are stored locally in this browser.
          </small>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="topbar glass">
        <div className="brand">
          <div className="logo">T</div>
          <span>TaskFlow</span>
        </div>

        <div className="header-actions">
          {user && (
            <div className="header-user">
              <div className="header-avatar">{initials}</div>
              <span>{displayName}</span>
            </div>
          )}

          <button className="logout-btn" onClick={logout}>
            Logout ↗
          </button>
        </div>
      </header>

      <main className="container">
        <section className="welcome">
          <div>
            <p className="eyebrow">YOUR WORKSPACE</p>
            <h1>Manage your day.</h1>
            <p>Stay focused. Stay productive. Make it happen.</p>
          </div>

          <div className="welcome-icon">✓</div>
        </section>

        {/* USER PROFILE */}

        <section className="profile-card glass">
          <div className="profile-avatar">{initials}</div>

          <div className="profile-details">
            <span className="eyebrow">YOUR ACCOUNT</span>
            <h2>{displayName}</h2>
            <p>{displayEmail}</p>
            <span className="account-status">
              <span className="online-dot" />
              Account connected
            </span>
          </div>

          <div className="profile-badge">
            <span>✓</span>
            <p>Verified</p>
          </div>
        </section>

        <section className="stats">
          <div className="stat-card glass">
            <span>Total Missions</span>
            <h2>{tasks.length}</h2>
            <p>All your tasks</p>
          </div>

          <div className="stat-card glass">
            <span>Active Missions</span>
            <h2>{pending}</h2>
            <p>Waiting to be completed</p>
          </div>

          <div className="stat-card glass">
            <span>Completed</span>
            <h2>{completed}</h2>
            <p>Successfully achieved</p>
          </div>
        </section>

        <section className="mission-card glass">
          <div className="mission-icon">✦</div>
          <div>
            <span className="eyebrow">YOUR CURRENT MISSION</span>
            <h3>{mission.title}</h3>
            <p>{mission.subtitle}</p>
          </div>
        </section>

        <section className="progress-card glass">
          <div className="progress-heading">
            <div>
              <h3>Mission Progress</h3>
              <p>Keep moving towards your goals.</p>
            </div>
            <strong>{progress}%</strong>
          </div>

          <div className="progress-track">
            <div
              className="progress-fill"
              style={{ width: `${progress}%` }}
            />
          </div>
        </section>

        {/* ACTIVITY HISTORY */}

        <section className="activity-section glass">
          <div className="activity-heading">
            <div>
              <span className="eyebrow">YOUR RECENT ACTIONS</span>
              <h2>Activity History</h2>
              <p>Every mission has a story. Track your progress here.</p>
            </div>

            <button
              className="clear-history-btn"
              onClick={clearHistory}
              disabled={activities.length === 0}
            >
              Clear History
            </button>
          </div>

          {activities.length === 0 ? (
            <div className="activity-empty">
              <div className="activity-empty-icon">◷</div>
              <h3>No activity yet</h3>
              <p>
                Your actions will appear here when you add,
                complete, edit or delete a mission.
              </p>
            </div>
          ) : (
            <div className="activity-list">
              {activities.slice(0, 8).map((activity) => (
                <article className="activity-item" key={activity.id}>
                  <div className={`activity-icon ${activity.type}`}>
                    {activityIcon[activity.type] || "•"}
                  </div>

                  <div className="activity-info">
                    <h4>{activity.title}</h4>
                    <p>{activity.description}</p>
                    <span>{formatActivityTime(activity.time)}</span>
                  </div>

                  <span className={`activity-tag ${activity.type}`}>
                    {activity.type}
                  </span>
                </article>
              ))}
            </div>
          )}
        </section>

        {/* CREATE MISSION */}

        <section className="form-card glass">
          <div className="section-heading">
            <span className="eyebrow">PLAN YOUR SUCCESS</span>
            <h2>
              {editingId ? "Update Your Mission" : "Create a New Mission"}
            </h2>
            <p>Every big achievement starts with a small task.</p>
          </div>

          <form onSubmit={saveTask}>
            <input
              name="title"
              value={form.title}
              onChange={handleChange}
              placeholder="Give your task a title..."
              required
            />

            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              placeholder="Add a little description about your mission..."
              rows="3"
            />

            <div className="form-row">
              <select
                name="priority"
                value={form.priority}
                onChange={handleChange}
              >
                <option value="low">Low Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="high">High Priority</option>
              </select>

              <input
                type="date"
                name="dueDate"
                value={form.dueDate}
                onChange={handleChange}
              />
            </div>

            <div className="form-actions">
              <button className="primary-btn" disabled={loading}>
                {loading
                  ? "Please wait..."
                  : editingId
                    ? "Save Changes"
                    : "＋ Add Mission"}
              </button>

              {editingId && (
                <button
                  type="button"
                  className="cancel-btn"
                  onClick={cancelEdit}
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </section>

        {error && <div className="error-box">{error}</div>}

        {/* MY MISSIONS */}

        <section className="tasks-section">
          <div className="tasks-heading">
            <div>
              <span className="eyebrow">YOUR DAILY GOALS</span>
              <h2>My Missions</h2>
              <p>{filteredTasks.length} missions found</p>
            </div>
          </div>

          <div className="filters">
            <input
              placeholder="Search your missions..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="all">All Missions</option>
              <option value="pending">Active</option>
              <option value="completed">Completed</option>
            </select>

            <button className="refresh-btn" onClick={loadTasks}>
              ↻ Refresh
            </button>
          </div>

          {loading && tasks.length === 0 ? (
            <div className="empty glass">
              <h3>Loading your missions...</h3>
              <p>Preparing your workspace.</p>
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="empty glass">
              <div className="empty-icon">✦</div>
              <h3>No missions found</h3>
              <p>Your next achievement starts with creating a task.</p>
            </div>
          ) : (
            <div className="task-list">
              {filteredTasks.map((task) => (
                <article className="task-card glass" key={task._id}>
                  <button
                    className={`check-btn ${task.status === "completed" ? "checked" : ""
                      }`}
                    onClick={() => toggleTask(task)}
                    title="Toggle completion"
                  >
                    {task.status === "completed" ? "✓" : ""}
                  </button>

                  <div className="task-info">
                    <h3 className={task.status === "completed" ? "done" : ""}>
                      {task.title}
                    </h3>

                    <p>{task.description || "No description added."}</p>

                    <div className="task-meta">
                      <span className={`priority ${task.priority}`}>
                        {task.priority} priority
                      </span>

                      <span className="status">
                        {task.status || "pending"}
                      </span>

                      {task.dueDate && (
                        <span className="date">
                          Due: {new Date(task.dueDate).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="task-actions">
                    <button onClick={() => editTask(task)}>Edit</button>

                    <button
                      className="delete-btn"
                      onClick={() => deleteTask(task._id)}
                    >
                      Delete
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>

      <footer>
        <p>TaskFlow © 2026 | Built with MERN Stack</p>
        <p>
          Designed &amp; Developed by <strong>Febin U</strong>
        </p>
        <span>BUILD YOUR GOALS. COMPLETE YOUR MISSIONS.</span>
      </footer>

      {toast && (
        <div className={`toast ${toast.type}`} role="status">
          <div className="toast-icon">✓</div>
          <div>
            <strong>{toast.title}</strong>
            <p>{toast.subtitle}</p>
          </div>
          <button
            className="toast-close"
            onClick={() => setToast(null)}
            aria-label="Dismiss notification"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
