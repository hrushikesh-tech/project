"use client";

import { getCsrfToken, signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { z } from "zod";

import { AppForm } from "@/components/forms/app-form";

import { FormField } from "@amdox/ui";

const loginSchema = z.object({
  username: z.string().trim().min(1, "Username is required."),
  password: z.string().min(1, "Password is required."),
});

type LoginFormValues = z.infer<typeof loginSchema>;

const defaultValues: LoginFormValues = {
  username: "",
  password: "",
};

export default function LoginPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [csrfToken, setCsrfToken] = useState("");

  useEffect(() => {
    let cancelled = false;

    void getCsrfToken().then((token) => {
      if (!cancelled) {
        setCsrfToken(token ?? "");
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(values: LoginFormValues) {
    setError(null);

    if (!csrfToken) {
      setError("CSRF token is still loading. Try again in a moment.");
      return;
    }

    await new Promise<void>((resolve) => {
      startTransition(() => {
        void (async () => {
          const result = await signIn("credentials", {
            csrfToken,
            username: values.username,
            password: values.password,
            redirect: false,
          });

          if (result?.error) {
            setError(
              "Sign-in failed. Check your credentials or Keycloak session state.",
            );
            resolve();
            return;
          }

          router.push("/dashboard");
          router.refresh();
          resolve();
        })();
      });
    });
  }

  return (
    <AppForm<LoginFormValues>
      title="Sign in"
      description="Credentials are exchanged through the backend auth contract, which proxies Keycloak and now enforces rotated session state."
      schema={loginSchema}
      defaultValues={defaultValues}
      submitLabel={isPending ? "Signing in..." : "Sign in"}
      successMessage={null}
      onSubmit={handleSubmit}
    >
      {(methods) => (
        <>
          <FormField
            id="username"
            label="Username"
            required
            helpText="Credentials are exchanged through the existing backend auth contract, which proxies Keycloak."
            error={methods.formState.errors.username?.message}
            inputProps={{
              ...methods.register("username"),
              placeholder: "finance.phase12@amdox.dev",
              autoComplete: "username",
            }}
          />
          <FormField
            id="password"
            label="Password"
            required
            error={methods.formState.errors.password?.message}
            inputProps={{
              ...methods.register("password"),
              placeholder: "........",
              type: "password",
              autoComplete: "current-password",
            }}
          />
          {error ? (
            <p
              style={{
                margin: 0,
                padding: "0.8rem 0.95rem",
                borderRadius: "14px",
                background: "rgba(185,28,28,0.08)",
                color: "#b91c1c",
                fontWeight: 600,
              }}
            >
              {error}
            </p>
          ) : null}
        </>
      )}
    </AppForm>
  );
}
