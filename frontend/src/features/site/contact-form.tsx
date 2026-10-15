"use client";

import { useState } from "react";
import styles from "./contact-form.module.css";

export interface ContactFormData {
  name: string;
  email: string;
  organization: string;
  topic?: string;
  message: string;
}

export interface ContactFormErrors {
  name?: string;
  email?: string;
  organization?: string;
  message?: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_MESSAGE_LENGTH = 20;
const MAX_MESSAGE_LENGTH = 2000;

export const DEMO_HONEST_NOTICE =
  "This demo doesn't send messages. Email the team at the address in the README.";

export function ContactForm() {
  const [formData, setFormData] = useState<ContactFormData>({
    name: "",
    email: "",
    organization: "",
    topic: "",
    message: "",
  });

  const [errors, setErrors] = useState<ContactFormErrors>({});
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    if (errors[name as keyof ContactFormErrors]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const validate = (): boolean => {
    const nextErrors: ContactFormErrors = {};

    const trimmedName = formData.name.trim();
    if (!trimmedName) {
      nextErrors.name = "Please enter your name.";
    }

    const trimmedEmail = formData.email.trim();
    if (!trimmedEmail) {
      nextErrors.email = "Please enter your work email.";
    } else if (!EMAIL_REGEX.test(trimmedEmail)) {
      nextErrors.email = "Please enter a valid email address.";
    }

    const trimmedOrg = formData.organization.trim();
    if (!trimmedOrg) {
      nextErrors.organization = "Please enter your organization name.";
    }

    const trimmedMsg = formData.message.trim();
    if (!trimmedMsg) {
      nextErrors.message = `Please enter a message (${MIN_MESSAGE_LENGTH}–${MAX_MESSAGE_LENGTH} characters).`;
    } else if (trimmedMsg.length < MIN_MESSAGE_LENGTH) {
      nextErrors.message = `Message must be at least ${MIN_MESSAGE_LENGTH} characters (currently ${trimmedMsg.length}).`;
    } else if (trimmedMsg.length > MAX_MESSAGE_LENGTH) {
      nextErrors.message = `Message must not exceed ${MAX_MESSAGE_LENGTH} characters (currently ${trimmedMsg.length}).`;
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (validate()) {
      setSubmitted(true);
    }
  };

  const handleReset = () => {
    setSubmitted(false);
    setFormData({
      name: "",
      email: "",
      organization: "",
      topic: "",
      message: "",
    });
    setErrors({});
  };

  if (submitted) {
    return (
      <div className={styles.card} role="region" aria-label="Submission feedback">
        <h2 className={styles.cardTitle}>Send an enquiry</h2>
        <div className={styles.noticeContainer} role="status">
          <p className={styles.noticeText}>{DEMO_HONEST_NOTICE}</p>
          <button
            type="button"
            onClick={handleReset}
            className={styles.resetBtn}
          >
            Edit enquiry or try again
          </button>
        </div>
      </div>
    );
  }

  const messageLength = formData.message.trim().length;
  const isMessageTooShort = messageLength > 0 && messageLength < MIN_MESSAGE_LENGTH;
  const isMessageTooLong = messageLength > MAX_MESSAGE_LENGTH;

  return (
    <div className={styles.card}>
      <h2 className={styles.cardTitle}>Send an enquiry</h2>
      <form onSubmit={handleSubmit} className={styles.form} noValidate>
        <div className={styles.row}>
          <div className={styles.field}>
            <label htmlFor="contact-name" className={styles.label}>
              Name
            </label>
            <input
              id="contact-name"
              name="name"
              type="text"
              autoComplete="name"
              placeholder="Your name"
              value={formData.name}
              onChange={handleChange}
              aria-invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? "contact-name-error" : undefined}
              className={`${styles.input} ${errors.name ? styles.inputInvalid : ""}`}
            />
            {errors.name && (
              <span id="contact-name-error" role="alert" className={styles.error}>
                {errors.name}
              </span>
            )}
          </div>

          <div className={styles.field}>
            <label htmlFor="contact-email" className={styles.label}>
              Work email
            </label>
            <input
              id="contact-email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@organization.com"
              value={formData.email}
              onChange={handleChange}
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? "contact-email-error" : undefined}
              className={`${styles.input} ${errors.email ? styles.inputInvalid : ""}`}
            />
            {errors.email && (
              <span id="contact-email-error" role="alert" className={styles.error}>
                {errors.email}
              </span>
            )}
          </div>
        </div>

        <div className={styles.field}>
          <label htmlFor="contact-organization" className={styles.label}>
            Organization
          </label>
          <input
            id="contact-organization"
            name="organization"
            type="text"
            autoComplete="organization"
            placeholder="Organization name"
            value={formData.organization}
            onChange={handleChange}
            aria-invalid={Boolean(errors.organization)}
            aria-describedby={
              errors.organization ? "contact-organization-error" : undefined
            }
            className={`${styles.input} ${
              errors.organization ? styles.inputInvalid : ""
            }`}
          />
          {errors.organization && (
            <span
              id="contact-organization-error"
              role="alert"
              className={styles.error}
            >
              {errors.organization}
            </span>
          )}
        </div>

        <div className={styles.field}>
          <label htmlFor="contact-topic" className={styles.label}>
            Discussion topic
          </label>
          <input
            id="contact-topic"
            name="topic"
            type="text"
            placeholder="Demo / pricing / integration / security"
            value={formData.topic}
            onChange={handleChange}
            className={styles.input}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="contact-message" className={styles.label}>
            Message
          </label>
          <textarea
            id="contact-message"
            name="message"
            rows={5}
            placeholder="Briefly describe your needs; do not include case details."
            value={formData.message}
            onChange={handleChange}
            aria-invalid={Boolean(errors.message)}
            aria-describedby={
              errors.message
                ? "contact-message-error contact-message-count"
                : "contact-message-count"
            }
            className={`${styles.textarea} ${
              errors.message ? styles.textareaInvalid : ""
            }`}
          />
          <div
            id="contact-message-count"
            className={`${styles.charCount} ${
              isMessageTooShort || isMessageTooLong ? styles.charCountInvalid : ""
            }`}
          >
            {messageLength}/{MAX_MESSAGE_LENGTH} characters (min {MIN_MESSAGE_LENGTH})
          </div>
          {errors.message && (
            <span
              id="contact-message-error"
              role="alert"
              className={styles.error}
            >
              {errors.message}
            </span>
          )}
        </div>

        <button type="submit" className={styles.submitBtn}>
          Submit enquiry
        </button>
      </form>
    </div>
  );
}
