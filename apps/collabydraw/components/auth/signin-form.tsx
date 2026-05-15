'use client';

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { signIn } from "next-auth/react";
import { useSearchParams, useRouter } from "next/navigation";
import { useTransition, useState } from "react";
import { Button } from "@/components/ui/button";
import {
    Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { SigninSchema } from "@repo/common/types";
import { Loader2 } from "lucide-react";

type SignInFormValues = z.infer<typeof SigninSchema>;

// ── Social buttons ────────────────────────────────────────────────────────────

function GoogleIcon() {
    return (
        <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
        </svg>
    );
}

function GitHubIcon() {
    return (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
        </svg>
    );
}

interface SocialButtonProps {
    provider: "google" | "github";
    callbackUrl: string;
    label: string;
    icon: React.ReactNode;
}

function SocialButton({ provider, callbackUrl, label, icon }: SocialButtonProps) {
    const [loading, setLoading] = useState(false);
    return (
        <button
            type="button"
            disabled={loading}
            onClick={async () => {
                setLoading(true);
                await signIn(provider, { callbackUrl });
            }}
            className="w-full flex items-center justify-center gap-3 h-11 px-4 rounded-xl border border-[#e5e5e5] bg-white hover:bg-gray-50 text-[#171717] text-sm font-medium transition-all disabled:opacity-60 shadow-sm"
        >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : icon}
            {label}
        </button>
    );
}

// ── Main form ─────────────────────────────────────────────────────────────────

export function SignInForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";
    const [isPending, startTransition] = useTransition();

    const form = useForm<SignInFormValues>({
        resolver: zodResolver(SigninSchema),
        defaultValues: { email: "", password: "" },
    });

    async function onSubmit(values: SignInFormValues) {
        startTransition(async () => {
            try {
                const result = await signIn("credentials", {
                    email: values.email,
                    password: values.password,
                    redirect: false,
                });
                if (result?.error) { toast.error(result.error); return; }
                toast.success("Signed in successfully");
                router.push(callbackUrl);
                router.refresh();
            } catch (error) {
                toast.error("Something went wrong. Please try again.");
                console.error(error);
            }
        });
    }

    return (
        <div className="space-y-4">
            {/* Social OAuth buttons */}
            <div className="space-y-2.5">
                <SocialButton provider="google" callbackUrl={callbackUrl} label="Continue with Google" icon={<GoogleIcon />} />
                <SocialButton provider="github" callbackUrl={callbackUrl} label="Continue with GitHub" icon={<GitHubIcon />} />
            </div>

            {/* Divider */}
            <div className="relative flex items-center gap-3">
                <div className="flex-1 h-px bg-[#e5e5e5]" />
                <span className="text-xs text-[#999] shrink-0">or continue with email</span>
                <div className="flex-1 h-px bg-[#e5e5e5]" />
            </div>

            {/* Credentials form */}
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
                    <FormField control={form.control} name="email" render={({ field }) => (
                        <FormItem>
                            <FormLabel className="sr-only">Email</FormLabel>
                            <FormControl>
                                <Input {...field} disabled={isPending} placeholder="Enter your email"
                                    className="h-11 bg-form-input hover:bg-form-input-hover p-3 border rounded-xl border-color-border-input text-form-color-text !ring-0 !outline-0 focus:border-color-outline-focus focus:border-[2px]" />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                    <FormField control={form.control} name="password" render={({ field }) => (
                        <FormItem>
                            <FormLabel className="sr-only">Password</FormLabel>
                            <FormControl>
                                <Input {...field} type="password" disabled={isPending} placeholder="Enter your password"
                                    className="h-11 bg-form-input hover:bg-form-input-hover p-3 border rounded-xl border-color-border-input text-form-color-text !ring-0 !outline-0 focus:border-color-outline-focus focus:border-[2px]" />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                    <Button type="submit" disabled={isPending} size="lg"
                        className="!mt-2 w-full h-11 rounded-xl text-sm font-semibold shadow-none bg-color-primary hover:bg-brand-hover active:bg-brand-active active:scale-[.98]">
                        {isPending ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Signing in…</> : "Sign In"}
                    </Button>
                </form>
            </Form>
        </div>
    );
}