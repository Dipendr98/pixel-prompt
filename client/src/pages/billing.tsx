import { useAuth } from "@/lib/auth";
import { useMutation } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Layers, ArrowLeft, Sparkles, Download, MessageSquare, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

declare global {
  interface Window {
    Razorpay: any;
  }
}

export default function Billing() {
  const { user, isPro } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const cancelMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/subscription/cancel");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({ title: "Subscription cancelled", description: "Your Pro access has been removed" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const upgradeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/razorpay/order");
      const data = await res.json();
      return data;
    },
    onSuccess: (data) => {
      if (data.disabled) {
        toast({ title: "Payments disabled", description: "Razorpay keys not configured", variant: "destructive" });
        return;
      }

      const options = {
        key: data.key_id,
        amount: data.amount,
        currency: data.currency,
        name: "PixelPrompt",
        description: "Pro Plan Subscription",
        order_id: data.order_id,
        handler: async (response: any) => {
          try {
            await apiRequest("POST", "/api/razorpay/verify", {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
            toast({ title: "Upgrade successful!", description: "You now have Pro access" });
          } catch (err: any) {
            toast({ title: "Verification failed", description: err.message, variant: "destructive" });
          }
        },
        prefill: {
          email: user?.email || "",
        },
        theme: {
          color: "#3b82f6",
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const freePlanFeatures = [
    { icon: Layers, text: "Unlimited projects" },
    { icon: MessageSquare, text: "3 AI calls per day" },
    { icon: Check, text: "Drag & drop builder" },
    { icon: Check, text: "Submit to team" },
  ];

  const proPlanFeatures = [
    { icon: Sparkles, text: "Everything in Free" },
    { icon: MessageSquare, text: "Unlimited AI calls" },
    { icon: Download, text: "Export to ZIP" },
    { icon: Zap, text: "Priority support" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="max-w-4xl mx-auto flex items-center gap-4 px-6 py-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} data-testid="button-back">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-md bg-primary">
              <Layers className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-semibold tracking-tight">PixelPrompt</span>
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold" data-testid="text-billing-title">Billing & Plans</h1>
          <p className="text-muted-foreground text-sm mt-1">Choose the plan that works best for you</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          <Card className={!isPro ? "ring-2 ring-primary" : ""}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h3 className="font-semibold text-lg">Free</h3>
                {!isPro && <Badge variant="secondary" data-testid="badge-current-plan">Current Plan</Badge>}
              </div>
              <div className="mt-2">
                <span className="text-3xl font-bold">$0</span>
                <span className="text-muted-foreground text-sm">/month</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 pt-4">
              {freePlanFeatures.map((f, i) => (
                <div key={i} className="flex items-center gap-3 text-sm">
                  <f.icon className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span>{f.text}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className={isPro ? "ring-2 ring-primary" : ""}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h3 className="font-semibold text-lg">Pro</h3>
                {isPro && <Badge data-testid="badge-current-plan">Current Plan</Badge>}
              </div>
              <div className="mt-2">
                <span className="text-3xl font-bold">$9</span>
                <span className="text-muted-foreground text-sm">/month</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 pt-4">
              {proPlanFeatures.map((f, i) => (
                <div key={i} className="flex items-center gap-3 text-sm">
                  <f.icon className="w-4 h-4 text-primary shrink-0" />
                  <span>{f.text}</span>
                </div>
              ))}
              {!isPro && (
                <Button
                  className="w-full mt-4"
                  onClick={() => upgradeMutation.mutate()}
                  disabled={upgradeMutation.isPending}
                  data-testid="button-upgrade"
                >
                  {upgradeMutation.isPending ? "Processing..." : "Upgrade to Pro"}
                </Button>
              )}
              {isPro && (
                <div className="space-y-3 mt-2">
                  <div className="text-sm text-muted-foreground text-center" data-testid="text-active-sub">
                    Your subscription is active
                  </div>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => cancelMutation.mutate()}
                    disabled={cancelMutation.isPending}
                    data-testid="button-cancel-subscription"
                  >
                    {cancelMutation.isPending ? "Cancelling..." : "Cancel Subscription"}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
