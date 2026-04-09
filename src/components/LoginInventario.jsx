import { useState } from "react";
import { supabase } from "../lib/supabase";

export default function LoginInventario() {
  const [form, setForm] = useState({ email: "", senha: "" });
  const [erro, setErro] = useState("");

  async function handleLogin() {
    setErro("");

    const { error } = await supabase.auth.signInWithPassword({
      email: form.email,
      password: form.senha,
    });

    if (error) {
      setErro(error.message);
    }
  }

  return null;
}
