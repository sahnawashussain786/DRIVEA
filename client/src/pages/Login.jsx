import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

const Login = ({ mode = "login" }) => {
  const isRegistered = mode === "register";
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [isLoading, setIsLaoding] = useState(false);
  const updateField = (key, value) =>
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  return (
    <div className="min-h-screen text-zinc-900 flex flex-col md:flex-row">
      {/* left hero brand panel */}
      <div className="md:w-1/2 p-8 md:p-12 lg:p-16 bg-linear-to-br from-orange-50 via-zinc-100 to-red-50 border-b md:border-b-0 md:border-r border-zinc-200 flex flex-col justify-between relative overflow-hidden"></div>  
      <div className='absolute inset-0 bg-[url("/pattern.svg")]'></div>
      <div className="relative z-10 flex items-center gap-3">
        <img className="max-h-9" src="/logo.svg" alt="drivea logo" />
        <span className="text-4xl font-medium uppercase text-zinc-900">Drivea</span>
      </div>
      {/* right auth form */}
    </div>
  );
};

export default Login;
