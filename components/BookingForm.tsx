"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { book } from "@/lib/content";
import { bookingSchema, type BookingInput } from "@/lib/schema";
import { trackBookSprint } from "@/lib/analytics";

const f = book.form;

/**
 * Booking form: client-side validation (React Hook Form + Zod), POST to
 * /api/book (which forwards to the n8n webhook), `book_sprint` dataLayer
 * event on success, inline success state — no redirect.
 */
export default function BookingForm() {
  const [sent, setSent] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<BookingInput>({
    resolver: zodResolver(bookingSchema),
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      const res = await fetch("/api/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setServerError(
          typeof data?.error === "string" ? data.error : f.serverError
        );
        return;
      }
      trackBookSprint({ niche: values.niche, frequency: values.frequency });
      setSent(true);
    } catch {
      setServerError(f.serverError);
    }
  });

  if (sent) {
    return (
      <div className="form-success" role="status">
        <p className="big">{f.success.big}</p>
        <p>
          {f.success.bodyBefore}
          <span className="wa">{f.success.wa}</span>
          {f.success.bodyAfter}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <h3>{f.heading}</h3>
      <p className="form-sub">{f.sub}</p>

      <div className="field">
        <label htmlFor="f-name">{f.fields.name.label}</label>
        <input
          id="f-name"
          type="text"
          autoComplete="name"
          aria-invalid={errors.name ? "true" : undefined}
          aria-describedby={errors.name ? "f-name-err" : undefined}
          {...register("name")}
        />
        {errors.name && (
          <p className="field-err" id="f-name-err">
            {errors.name.message}
          </p>
        )}
      </div>

      <div className="field">
        <label htmlFor="f-email">{f.fields.email.label}</label>
        <input
          id="f-email"
          type="email"
          autoComplete="email"
          aria-invalid={errors.email ? "true" : undefined}
          aria-describedby={errors.email ? "f-email-err" : undefined}
          {...register("email")}
        />
        {errors.email && (
          <p className="field-err" id="f-email-err">
            {errors.email.message}
          </p>
        )}
      </div>

      <div className="field">
        <label htmlFor="f-wa">{f.fields.whatsapp.label}</label>
        <input
          id="f-wa"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder={f.fields.whatsapp.placeholder}
          aria-invalid={errors.whatsapp ? "true" : undefined}
          aria-describedby={errors.whatsapp ? "f-wa-err" : undefined}
          {...register("whatsapp")}
        />
        {errors.whatsapp && (
          <p className="field-err" id="f-wa-err">
            {errors.whatsapp.message}
          </p>
        )}
      </div>

      <div className="field">
        <label htmlFor="f-niche">{f.fields.niche.label}</label>
        <select
          id="f-niche"
          defaultValue=""
          aria-invalid={errors.niche ? "true" : undefined}
          aria-describedby={errors.niche ? "f-niche-err" : undefined}
          {...register("niche")}
        >
          <option value="">{f.fields.niche.placeholder}</option>
          {f.fields.niche.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {errors.niche && (
          <p className="field-err" id="f-niche-err">
            {errors.niche.message}
          </p>
        )}
      </div>

      <div className="field">
        <label htmlFor="f-freq">{f.fields.frequency.label}</label>
        <select
          id="f-freq"
          defaultValue=""
          aria-invalid={errors.frequency ? "true" : undefined}
          aria-describedby={errors.frequency ? "f-freq-err" : undefined}
          {...register("frequency")}
        >
          <option value="">{f.fields.frequency.placeholder}</option>
          {f.fields.frequency.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {errors.frequency && (
          <p className="field-err" id="f-freq-err">
            {errors.frequency.message}
          </p>
        )}
      </div>

      {/* Honeypot — hidden from people, tempting to bots. */}
      <div className="hp-field" aria-hidden="true">
        <label htmlFor="f-company">Company</label>
        <input
          id="f-company"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          {...register("company")}
        />
      </div>

      <button
        className="btn btn-primary"
        type="submit"
        disabled={isSubmitting}
        aria-busy={isSubmitting}
      >
        {isSubmitting ? f.submitting : f.submit}{" "}
        <span className="arrow">→</span>
      </button>
      {serverError && (
        <p className="form-err" role="alert">
          {serverError}
        </p>
      )}
      <p className="form-fine">{f.fine}</p>
    </form>
  );
}
