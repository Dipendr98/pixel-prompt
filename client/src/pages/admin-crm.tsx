import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, ArrowLeft, Shield, Mail, Phone, MapPin, Send, MessageSquare, Settings } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { UserQuery, SiteSettings } from "@shared/schema";
import { format } from "date-fns";

export default function AdminCrm() {
    const { user } = useAuth();
    const [, navigate] = useLocation();
    const { toast } = useToast();

    const [replyQueryId, setReplyQueryId] = useState<string | null>(null);
    const [replyText, setReplyText] = useState("");

    const [settingsForm, setSettingsForm] = useState({
        contactEmail: "",
        contactPhone: "",
        contactAddress: ""
    });

    const { data: queries, isLoading: queriesLoading } = useQuery<UserQuery[]>({
        queryKey: ["/api/admin/queries"],
    });

    const { data: settings, isLoading: settingsLoading } = useQuery<SiteSettings>({
        queryKey: ["/api/site-settings"],
    });

    // Populate settings form when data arrives
    useState(() => {
        if (settings) {
            setSettingsForm({
                contactEmail: settings.contactEmail,
                contactPhone: settings.contactPhone,
                contactAddress: settings.contactAddress
            });
        }
    });

    const replyMutation = useMutation({
        mutationFn: async ({ id, reply }: { id: string; reply: string }) => {
            await apiRequest("POST", `/api/admin/queries/${id}/respond`, { reply });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/admin/queries"] });
            toast({ title: "Reply sent", description: "The user has been notified." });
            setReplyQueryId(null);
            setReplyText("");
        },
        onError: (err: any) => {
            toast({ title: "Failed to reply", description: err.message, variant: "destructive" });
        }
    });

    const settingsMutation = useMutation({
        mutationFn: async (data: Partial<SiteSettings>) => {
            await apiRequest("PATCH", `/api/admin/site-settings`, data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/site-settings"] });
            toast({ title: "Settings updated", description: "Contact details updated successfully." });
        },
        onError: (err: any) => {
            toast({ title: "Failed to update", description: err.message, variant: "destructive" });
        }
    });

    if (user?.role !== "admin") {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <Card className="max-w-md w-full mx-auto">
                    <CardContent className="py-12 text-center">
                        <Shield className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                        <h2 className="text-xl font-bold mb-2">Access Denied</h2>
                        <p className="text-muted-foreground mb-6">You need administrator privileges to view the CRM dashboard.</p>
                        <Button onClick={() => navigate("/dashboard")}>Return to Dashboard</Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background flex flex-col">
            <header className="border-b bg-card">
                <div className="max-w-6xl mx-auto flex items-center gap-4 px-6 py-4">
                    <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <div className="flex flex-col">
                        <h1 className="text-xl font-bold tracking-tight">Admin CRM</h1>
                        <p className="text-sm text-muted-foreground">Manage user inquiries and dynamic site settings</p>
                    </div>
                </div>
            </header>

            <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-8">
                <Tabs defaultValue="inquiries" className="space-y-6">
                    <TabsList className="grid w-full max-w-md grid-cols-2">
                        <TabsTrigger value="inquiries" className="flex items-center gap-2">
                            <MessageSquare className="w-4 h-4" />
                            Inquiries
                            {queries && queries.filter(q => q.status === "pending").length > 0 && (
                                <Badge variant="secondary" className="ml-1 px-1.5 min-w-5 h-5 flex items-center justify-center rounded-full text-[10px]">
                                    {queries.filter(q => q.status === "pending").length}
                                </Badge>
                            )}
                        </TabsTrigger>
                        <TabsTrigger value="settings" className="flex items-center gap-2">
                            <Settings className="w-4 h-4" />
                            Site Settings
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="inquiries" className="space-y-4">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold tracking-tight">Public Inquiries</h2>
                            <p className="text-sm text-muted-foreground">Messages submitted through the public Contact page.</p>
                        </div>

                        {queriesLoading ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                            </div>
                        ) : queries && queries.length > 0 ? (
                            <div className="grid gap-4">
                                {queries.map((q) => (
                                    <Card key={q.id}>
                                        <CardHeader className="pb-3 border-b bg-muted/20">
                                            <div className="flex items-center justify-between gap-4">
                                                <div className="space-y-1">
                                                    <CardTitle className="text-base font-semibold">{q.subject}</CardTitle>
                                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                        <span className="font-medium text-foreground">{q.name}</span>
                                                        <span>&bull;</span>
                                                        <a href={`mailto:${q.email}`} className="text-primary hover:underline">{q.email}</a>
                                                        <span>&bull;</span>
                                                        <span>{q.createdAt ? format(new Date(q.createdAt), "MMM d, yyyy 'at' h:mm a") : ""}</span>
                                                    </div>
                                                </div>
                                                <Badge variant={q.status === "pending" ? "destructive" : "default"}>
                                                    {q.status === "pending" ? "Awaiting Reply" : "Answered"}
                                                </Badge>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="pt-4 space-y-4">
                                            <div className="bg-card text-sm p-4 rounded-md border text-card-foreground whitespace-pre-wrap">
                                                {q.message}
                                            </div>

                                            {q.adminReply ? (
                                                <div className="bg-primary/5 p-4 rounded-md border border-primary/10">
                                                    <p className="text-xs font-semibold text-primary mb-2 uppercase tracking-wider">Your Reply</p>
                                                    <p className="text-sm text-foreground whitespace-pre-wrap">{q.adminReply}</p>
                                                    <p className="text-xs text-muted-foreground mt-2">
                                                        {q.updatedAt ? `Replied on ${format(new Date(q.updatedAt), "MMM d, yyyy")}` : ""}
                                                    </p>
                                                </div>
                                            ) : (
                                                <div className="space-y-3 pt-2">
                                                    <h4 className="text-sm font-medium">Respond to Inquiry</h4>
                                                    <Textarea
                                                        placeholder="Write your email reply here. The user will receive this as an email notification..."
                                                        rows={4}
                                                        value={replyQueryId === q.id ? replyText : ""}
                                                        onChange={(e) => {
                                                            setReplyQueryId(q.id);
                                                            setReplyText(e.target.value);
                                                        }}
                                                        className="resize-none"
                                                        disabled={replyMutation.isPending && replyQueryId === q.id}
                                                    />
                                                    <div className="flex justify-end">
                                                        <Button
                                                            size="sm"
                                                            className="w-full sm:w-auto flex items-center gap-2"
                                                            disabled={!replyText.trim() || replyQueryId !== q.id || replyMutation.isPending}
                                                            onClick={() => replyMutation.mutate({ id: q.id, reply: replyText })}
                                                        >
                                                            {replyMutation.isPending && replyQueryId === q.id ? (
                                                                <><Loader2 className="w-4 h-4 animate-spin" /> Sending...</>
                                                            ) : (
                                                                <><Send className="w-4 h-4" /> Send Email Reply</>
                                                            )}
                                                        </Button>
                                                    </div>
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        ) : (
                            <Card>
                                <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                                    <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
                                        <MessageSquare className="w-6 h-6 text-muted-foreground" />
                                    </div>
                                    <h3 className="text-lg font-medium mb-1">No Inquiries Found</h3>
                                    <p className="text-muted-foreground text-sm max-w-sm mx-auto">
                                        When public users fill out the contact form, their queries will appear here.
                                    </p>
                                </CardContent>
                            </Card>
                        )}
                    </TabsContent>

                    <TabsContent value="settings" className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Global Contact Details</CardTitle>
                                <CardDescription>
                                    Update the contact information displayed publicly on the Contact Us landing page.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                {settingsLoading ? (
                                    <div className="flex items-center justify-center py-8">
                                        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                                    </div>
                                ) : (
                                    <form
                                        onSubmit={(e) => {
                                            e.preventDefault();
                                            settingsMutation.mutate(settingsForm);
                                        }}
                                        className="space-y-6 max-w-lg"
                                    >
                                        <div className="space-y-4">
                                            <div className="space-y-2">
                                                <label className="text-sm font-medium flex items-center gap-2">
                                                    <Mail className="w-4 h-4 text-muted-foreground" />
                                                    Support Email
                                                </label>
                                                <Input
                                                    type="email"
                                                    value={settingsForm.contactEmail || settings?.contactEmail || ""}
                                                    onChange={(e) => setSettingsForm(p => ({ ...p, contactEmail: e.target.value }))}
                                                    placeholder="support@pixel-prompt.app"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-sm font-medium flex items-center gap-2">
                                                    <Phone className="w-4 h-4 text-muted-foreground" />
                                                    Business Phone
                                                </label>
                                                <Input
                                                    type="text"
                                                    value={settingsForm.contactPhone || settings?.contactPhone || ""}
                                                    onChange={(e) => setSettingsForm(p => ({ ...p, contactPhone: e.target.value }))}
                                                    placeholder="+1 (555) 000-0000"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-sm font-medium flex items-center gap-2">
                                                    <MapPin className="w-4 h-4 text-muted-foreground" />
                                                    Physical Address
                                                </label>
                                                <Input
                                                    type="text"
                                                    value={settingsForm.contactAddress || settings?.contactAddress || ""}
                                                    onChange={(e) => setSettingsForm(p => ({ ...p, contactAddress: e.target.value }))}
                                                    placeholder="123 Builder Lane, Tech District"
                                                />
                                            </div>
                                        </div>

                                        <Button
                                            type="submit"
                                            disabled={settingsMutation.isPending}
                                            className="w-full sm:w-auto"
                                        >
                                            {settingsMutation.isPending ? (
                                                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</>
                                            ) : "Save Changes"}
                                        </Button>
                                    </form>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </main>
        </div>
    );
}
