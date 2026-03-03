import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Mail, Phone, MapPin, Send, ArrowLeft, Loader2 } from "lucide-react";
import type { SiteSettings } from "@shared/schema";

export default function Contact() {
    const { toast } = useToast();
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        subject: "",
        message: "",
    });

    const { data: settings, isLoading: settingsLoading } = useQuery<SiteSettings>({
        queryKey: ["/api/site-settings"],
    });

    const submitMutation = useMutation({
        mutationFn: async (data: typeof formData) => {
            await apiRequest("POST", "/api/queries", data);
        },
        onSuccess: () => {
            toast({
                title: "Message Sent!",
                description: "We have received your message and will get back to you shortly.",
            });
            setFormData({ name: "", email: "", subject: "", message: "" });
        },
        onError: (err: any) => {
            toast({
                title: "Failed to send message",
                description: err.message || "An unexpected error occurred",
                variant: "destructive",
            });
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        submitMutation.mutate(formData);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    };

    return (
        <div className="min-h-screen bg-background">
            <header className="border-b bg-card">
                <div className="max-w-6xl mx-auto flex items-center gap-4 px-6 py-4">
                    <Link href="/">
                        <Button variant="ghost" size="icon">
                            <ArrowLeft className="w-5 h-5" />
                        </Button>
                    </Link>
                    <div className="flex flex-col">
                        <h1 className="text-xl font-bold tracking-tight">Contact Us</h1>
                        <p className="text-sm text-muted-foreground">We're here to help</p>
                    </div>
                </div>
            </header>

            <main className="max-w-6xl mx-auto px-6 py-12 md:py-20">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-12 lg:gap-24">
                    {/* Contact Details Column */}
                    <div className="space-y-8">
                        <div>
                            <h2 className="text-3xl font-bold tracking-tight mb-4">Get in Touch</h2>
                            <p className="text-muted-foreground text-lg">
                                Have a question about PixelPrompt or need help with your account? Fill out the form, and our team will get back to you within 24 hours.
                            </p>
                        </div>

                        <div className="space-y-6">
                            {settingsLoading ? (
                                <div className="flex items-center gap-3 text-muted-foreground">
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    <span>Loading contact details...</span>
                                </div>
                            ) : settings ? (
                                <>
                                    <div className="flex items-center gap-4">
                                        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 text-primary">
                                            <Mail className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-foreground">Email</h3>
                                            <p className="text-muted-foreground">{settings.contactEmail}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 text-primary">
                                            <Phone className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-foreground">Phone</h3>
                                            <p className="text-muted-foreground">{settings.contactPhone}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 text-primary">
                                            <MapPin className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-foreground">Office</h3>
                                            <p className="text-muted-foreground">{settings.contactAddress}</p>
                                        </div>
                                    </div>
                                </>
                            ) : null}
                        </div>
                    </div>

                    {/* Form Column */}
                    <div className="bg-card p-8 rounded-xl border shadow-sm">
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label htmlFor="name" className="text-sm font-medium">Name</label>
                                        <Input
                                            id="name"
                                            name="name"
                                            placeholder="Your Name"
                                            value={formData.name}
                                            onChange={handleChange}
                                            required
                                            disabled={submitMutation.isPending}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label htmlFor="email" className="text-sm font-medium">Email</label>
                                        <Input
                                            id="email"
                                            name="email"
                                            type="email"
                                            placeholder="you@example.com"
                                            value={formData.email}
                                            onChange={handleChange}
                                            required
                                            disabled={submitMutation.isPending}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label htmlFor="subject" className="text-sm font-medium">Subject</label>
                                    <Input
                                        id="subject"
                                        name="subject"
                                        placeholder="How can we help?"
                                        value={formData.subject}
                                        onChange={handleChange}
                                        required
                                        disabled={submitMutation.isPending}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label htmlFor="message" className="text-sm font-medium">Message</label>
                                    <Textarea
                                        id="message"
                                        name="message"
                                        placeholder="Provide as much detail as possible..."
                                        rows={5}
                                        value={formData.message}
                                        onChange={handleChange}
                                        required
                                        className="resize-none"
                                        disabled={submitMutation.isPending}
                                    />
                                </div>
                            </div>

                            <Button
                                type="submit"
                                className="w-full flex items-center justify-center gap-2 h-12 text-md"
                                disabled={submitMutation.isPending}
                            >
                                {submitMutation.isPending ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        Sending...
                                    </>
                                ) : (
                                    <>
                                        <Send className="w-5 h-5" />
                                        Send Message
                                    </>
                                )}
                            </Button>
                        </form>
                    </div>
                </div>
            </main>
        </div>
    );
}
