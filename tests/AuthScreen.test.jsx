import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("../src/services/firebaseAuth.js", () => ({
  getGoogleRedirectResult: vi.fn(() => Promise.resolve(null)),
  sendPasswordReset: vi.fn(() => Promise.resolve()),
  signInWithEmail: vi.fn(() => Promise.resolve()),
  signInWithGoogle: vi.fn(() => Promise.resolve()),
  signUpWithEmail: vi.fn(() => Promise.resolve()),
}));

import { AuthScreen } from "../src/screens/AuthScreen.jsx";
import { sendPasswordReset, signInWithEmail, signUpWithEmail } from "../src/services/firebaseAuth.js";

beforeEach(() => {
  vi.clearAllMocks();
});

// The mode tabs and the submit button share labels ("Sign In" / "Create
// Account"); the submit is always the later one in the DOM.
const submitButton = (name) => screen.getAllByRole("button", { name }).at(-1);

async function openSignup(user) {
  render(<AuthScreen />);
  await user.click(submitButton("Create Account"));
}

describe("sign in", () => {
  it("submits email + password", async () => {
    const user = userEvent.setup();
    render(<AuthScreen />);
    await user.type(screen.getByPlaceholderText("Email"), "favour@example.com");
    await user.type(screen.getByPlaceholderText("Password"), "secret123");
    await user.click(submitButton("Sign In"));
    expect(signInWithEmail).toHaveBeenCalledWith("favour@example.com", "secret123");
  });

  it("requires both fields", async () => {
    const user = userEvent.setup();
    render(<AuthScreen />);
    await user.click(submitButton("Sign In"));
    expect(await screen.findByText(/enter your email and password/i)).toBeInTheDocument();
    expect(signInWithEmail).not.toHaveBeenCalled();
  });
});

describe("create account", () => {
  it("rejects mismatched confirm password without calling Firebase", async () => {
    const user = userEvent.setup();
    await openSignup(user);
    await user.type(screen.getByPlaceholderText("Email"), "new@example.com");
    await user.type(screen.getByPlaceholderText("Password"), "secret123");
    await user.type(screen.getByPlaceholderText("Confirm password"), "different");
    await user.click(submitButton("Create Account"));
    expect(await screen.findByText(/passwords don't match/i)).toBeInTheDocument();
    expect(signUpWithEmail).not.toHaveBeenCalled();
  });

  it("rejects short passwords", async () => {
    const user = userEvent.setup();
    await openSignup(user);
    await user.type(screen.getByPlaceholderText("Email"), "new@example.com");
    await user.type(screen.getByPlaceholderText("Password"), "abc");
    await user.type(screen.getByPlaceholderText("Confirm password"), "abc");
    await user.click(submitButton("Create Account"));
    expect(await screen.findByText(/at least 6 characters/i)).toBeInTheDocument();
    expect(signUpWithEmail).not.toHaveBeenCalled();
  });

  it("requires the confirmation field", async () => {
    const user = userEvent.setup();
    await openSignup(user);
    await user.type(screen.getByPlaceholderText("Email"), "new@example.com");
    await user.type(screen.getByPlaceholderText("Password"), "secret123");
    await user.click(submitButton("Create Account"));
    expect(await screen.findByText(/confirm your password/i)).toBeInTheDocument();
    expect(signUpWithEmail).not.toHaveBeenCalled();
  });

  it("creates the account when everything matches", async () => {
    const user = userEvent.setup();
    await openSignup(user);
    await user.type(screen.getByPlaceholderText("Email"), "new@example.com");
    await user.type(screen.getByPlaceholderText("Password"), "secret123");
    await user.type(screen.getByPlaceholderText("Confirm password"), "secret123");
    await user.click(submitButton("Create Account"));
    expect(signUpWithEmail).toHaveBeenCalledWith("new@example.com", "secret123");
  });
});

describe("forgot password", () => {
  it("sends a reset email from reset mode", async () => {
    const user = userEvent.setup();
    render(<AuthScreen />);
    await user.click(screen.getByRole("button", { name: "Forgot password?" }));
    await user.type(screen.getByPlaceholderText("Email"), "favour@example.com");
    await user.click(screen.getByRole("button", { name: "Send Reset Link" }));
    expect(sendPasswordReset).toHaveBeenCalledWith("favour@example.com");
    expect(await screen.findByText(/reset link is on its way/i)).toBeInTheDocument();
  });

  it("requires an email before sending", async () => {
    const user = userEvent.setup();
    render(<AuthScreen />);
    await user.click(screen.getByRole("button", { name: "Forgot password?" }));
    await user.click(screen.getByRole("button", { name: "Send Reset Link" }));
    expect(await screen.findByText(/enter your email address/i)).toBeInTheDocument();
    expect(sendPasswordReset).not.toHaveBeenCalled();
  });

  it("returns to sign in", async () => {
    const user = userEvent.setup();
    render(<AuthScreen />);
    await user.click(screen.getByRole("button", { name: "Forgot password?" }));
    await user.click(screen.getByRole("button", { name: "Back to sign in" }));
    expect(submitButton("Sign In")).toBeInTheDocument();
  });
});
