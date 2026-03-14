"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface SetupStatus {
  setup_complete: boolean;
  media_accessible: boolean;
  media_root: string;
  file_count: number;
}

type Step = "welcome" | "credentials" | "done";

export default function SetupPage() {
  const router = useRouter();
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [step, setStep] = useState<Step>("welcome");

  // Form fields
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [appTitle, setAppTitle] = useState("KawKaw Catalog");
  const [appDesc, setAppDesc] = useState("");

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState("");

  useEffect(() => {
    fetch("/api/setup/status")
      .then((r) => r.json())
      .then((d: SetupStatus) => {
        if (d.setup_complete) {
          router.replace("/");
        } else {
          setStatus(d);
        }
      })
      .catch(() => setStatus(null));
  }, [router]);

  const validate = () => {
    const errs: Record<string, string> = {};
    if (username.trim().length < 3) errs.username = "At least 3 characters";
    if (!/^[a-zA-Z0-9_-]+$/.test(username.trim()))
      errs.username = "Letters, numbers, hyphens, underscores only";
    if (password.length < 8) errs.password = "At least 8 characters";
    if (password !== confirm) errs.confirm = "Passwords do not match";
    if (!appTitle.trim()) errs.appTitle = "App title is required";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    setApiError("");
    try {
      const res = await fetch("/api/setup/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          admin_username: username.trim(),
          admin_password: password,
          admin_password_confirm: confirm,
          app_title: appTitle.trim(),
          app_description: appDesc.trim() || null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setApiError(body?.detail ?? "Setup failed. Please try again.");
        return;
      }
      setStep("done");
    } catch {
      setApiError("Could not reach the server. Is the API running?");
    } finally {
      setSubmitting(false);
    }
  };

  if (!status) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-gray-500 text-sm">Connecting to server...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white">
            Welcome to <span className="text-brand-500">KawKaw</span>
          </h1>
          <p className="text-gray-400 mt-2">
            Let's get your photo catalog set up in a few steps.
          </p>
        </div>

        {/* Step: Welcome / Status */}
        {step === "welcome" && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-6">
            <h2 className="text-lg font-semibold text-white">System Status</h2>

            <StatusRow
              label="API Server"
              ok={true}
              okText="Connected"
              failText="Not reachable"
            />
            <StatusRow
              label="Media Folder"
              ok={status.media_accessible}
              okText={`Accessible — ${status.file_count >= 500 ? "500+" : status.file_count} media files found`}
              failText={`Not accessible (${status.media_root})`}
              hint={
                !status.media_accessible
                  ? "Mount your TrueNAS share on the Docker host and bind-mount it to /mnt/media. See SETUP.md."
                  : undefined
              }
            />

            <button
              onClick={() => setStep("credentials")}
              className="w-full bg-brand-600 hover:bg-brand-700 text-white font-medium py-2.5 rounded-lg transition-colors"
            >
              Continue →
            </button>
          </div>
        )}

        {/* Step: Credentials */}
        {step === "credentials" && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-5">
            <h2 className="text-lg font-semibold text-white">Create Admin Account</h2>

            {/* App title */}
            <Field
              label="Gallery Title"
              hint="Shown in the browser tab and public pages"
              error={errors.appTitle}
            >
              <input
                value={appTitle}
                onChange={(e) => setAppTitle(e.target.value)}
                className={input(errors.appTitle)}
                placeholder="KawKaw Catalog"
                autoFocus
              />
            </Field>

            {/* App description */}
            <Field label="Gallery Description" hint="Optional — shown on the public home page">
              <textarea
                value={appDesc}
                onChange={(e) => setAppDesc(e.target.value)}
                rows={2}
                className={input()}
                placeholder="A bird and wildlife photography catalog"
              />
            </Field>

            <hr className="border-gray-800" />

            {/* Username */}
            <Field label="Admin Username" error={errors.username}>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className={input(errors.username)}
                placeholder="admin"
                autoComplete="username"
              />
            </Field>

            {/* Password */}
            <Field label="Password" hint="At least 8 characters" error={errors.password}>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={input(errors.password)}
                autoComplete="new-password"
              />
            </Field>

            {/* Confirm */}
            <Field label="Confirm Password" error={errors.confirm}>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className={input(errors.confirm)}
                autoComplete="new-password"
              />
            </Field>

            {apiError && (
              <p className="text-red-400 text-sm bg-red-950/30 border border-red-800/40 rounded px-3 py-2">
                {apiError}
              </p>
            )}

            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setStep("welcome")}
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm py-2.5 rounded-lg transition-colors"
              >
                ← Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg transition-colors"
              >
                {submitting ? "Setting up..." : "Complete Setup"}
              </button>
            </div>
          </div>
        )}

        {/* Step: Done */}
        {step === "done" && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 text-center space-y-4">
            <div className="text-4xl">✓</div>
            <h2 className="text-xl font-bold text-white">Setup Complete!</h2>
            <p className="text-gray-400 text-sm">
              Your admin account has been created. You can now sign in.
            </p>
            <button
              onClick={() => router.push("/admin")}
              className="w-full bg-brand-600 hover:bg-brand-700 text-white font-medium py-2.5 rounded-lg transition-colors"
            >
              Go to Admin →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Small helpers ----

function StatusRow({
  label,
  ok,
  okText,
  failText,
  hint,
}: {
  label: string;
  ok: boolean;
  okText: string;
  failText: string;
  hint?: string;
}) {
  return (
    <div>
      <div className="flex items-start gap-3">
        <span
          className={`mt-0.5 w-4 h-4 rounded-full shrink-0 ${ok ? "bg-green-500" : "bg-red-500"}`}
        />
        <div>
          <p className="text-sm font-medium text-white">{label}</p>
          <p className={`text-xs mt-0.5 ${ok ? "text-green-400" : "text-red-400"}`}>
            {ok ? okText : failText}
          </p>
          {hint && <p className="text-xs text-gray-500 mt-1">{hint}</p>}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-300 mb-1">{label}</label>
      {children}
      {hint && !error && <p className="text-xs text-gray-500 mt-1">{hint}</p>}
      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
    </div>
  );
}

function input(error?: string) {
  return `w-full bg-gray-800 border rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500 ${
    error ? "border-red-600" : "border-gray-700"
  }`;
}
