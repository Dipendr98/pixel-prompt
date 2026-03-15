import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Layers, Eye, EyeOff, CheckCircle2, ArrowRight, XCircle } from "lucide-react";

function parseApiError(err: any): string {
  const msg = err?.message || "";
  const jsonStart = msg.indexOf("{");
  if (jsonStart >= 0) {
    try {
      const parsed = JSON.parse(msg.slice(jsonStart));
      return parsed.message || msg;
    } catch { /* fall through */ }
  }
  return msg || "Something went wrong";
}

export default function ResetPassword() {
  const [location] = useLocation();
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  // Extract token from URL query string: /reset-password?token=abc123
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("token");
    if (t) setToken(t);
  }, [location]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    if (!token) {
      setError("Invalid or missing reset token. Please request a new link.");
      return;
    }

    setLoading(true);
    try {
      await apiRequest("POST", "/api/auth/reset-password", { token, password });
      setDone(true);
    } catch (err: any) {
      setError(parseApiError(err));
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md space-y-6">
          <BrandHeader />
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center gap-4 py-4 text-center">
                <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center">
                  <XCircle className="w-7 h-7 text-destructive" />
                </div>
                <div>
                  <p className="font-medium">Invalid reset link</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    This link is missing the reset token. Please request a new one.
                  </p>
                </div>
                <Link href="/forgot-password">
                  <Button>Request new link</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        <BrandHeader />

        <Card>
          <CardHeader className="pb-4">
            <h2 className="text-lg font-semibold">
              {done ? "Password updated!" : "Set a new password"}
            </h2>
            {!done && (
              <p className="text-sm text-muted-foreground">
                Choose a strong password for your account.
              </p>
            )}
          </CardHeader>

          <CardContent>
            {done ? (
              <div className="flex flex-col items-center gap-4 py-4 text-center">
                <div className="w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center">
                  <CheckCircle2 className="w-7 h-7 text-emerald-500" />
                </div>
                <p className="text-sm text-muted-foreground">
                  Your password has been reset successfully.
                </p>
                <Link href="/login">
                  <Button className="gap-2">
                    Sign in now
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="text-sm text-destructive bg-destructive/10 rounded-md p-3">
                    {error}
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="password">New password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="At least 6 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm">Confirm new password</Label>
                  <Input
                    id="confirm"
                    type={showPassword ? "text" : "password"}
                    placeholder="Re-enter your password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                  />
                </div>

                {/* Password strength hint */}
                {password.length > 0 && (
                  <div className="flex gap-1">
                    {[...Array(4)].map((_, i) => (
                      <div
                        key={i}
                        className={`h-1 flex-1 rounded-full transition-colors ${
                          password.length >= (i + 1) * 3
                            ? password.length >= 12
                              ? "bg-emerald-500"
                              : password.length >= 8
                              ? "bg-yellow-500"
                              : "bg-red-500"
                            : "bg-muted"
                        }`}
                      />
                    ))}
                    <span className="text-xs text-muted-foreground ml-1">
                      {password.length < 6
                        ? "Too short"
                        : password.length < 8
                        ? "Weak"
                        : password.length < 12
                        ? "Good"
                        : "Strong"}
                    </span>
                  </div>
                )}

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Updating…" : "Reset password"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground">
          Remember your password?{" "}
          <Link href="/login" className="text-primary font-medium hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

function BrandHeader() {
  return (
    <div className="text-center space-y-2">
      <Link href="/" className="inline-flex items-center gap-2">
        <div className="flex items-center justify-center w-10 h-10 rounded-md bg-primary">
          <Layers className="w-5 h-5 text-primary-foreground" />
        </div>
        <span className="text-xl font-semibold tracking-tight">PixelPrompt</span>
      </Link>
      <p className="text-muted-foreground text-sm">Reset your password</p>
    </div>
  );
}
