"use client";

function csrfToken() {
  const match = document.cookie.split("; ").find((entry) => entry.startsWith("ssn_csrf="));
  return match ? decodeURIComponent(match.slice("ssn_csrf=".length)) : "";
}

export default function LogoutButton() {
  async function logout() {
    await fetch("/api/auth/logout", {
      method: "POST",
      headers: { "x-csrf-token": csrfToken() },
    });
    window.location.assign("/login");
  }

  return <button type="button" aria-label="Sign out" title="Sign out" onClick={logout}>↪</button>;
}
