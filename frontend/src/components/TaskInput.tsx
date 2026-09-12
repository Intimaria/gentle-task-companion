'use client'
import React from "react";
import { Circle, Clock, CheckCircle } from "@phosphor-icons/react";
import { useTranslation } from "../hooks/useTranslation";

type Props = {
  value: string;
  status: "not_started" | "in_progress" | "completed";
  onChange: (value: string) => void;
  onStatusChange: (status: "not_started" | "in_progress" | "completed") => void;
};
export default function TaskInput({ value, status, onChange, onStatusChange }: Props) {
  const { t } = useTranslation();
  function nextStatus() {
    if (!value) return; // Prevent status change if task is empty
    if (status === "not_started") return onStatusChange("in_progress");
    if (status === "in_progress") return onStatusChange("completed");
    return onStatusChange("not_started");
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={nextStatus}
        aria-label={t('changeTaskStatus')}
        className={`focus:outline-none ${!value ? "opacity-50 cursor-not-allowed" : ""}`}
        type="button"
        disabled={!value}
      >
        {status === "not_started" && <Circle size={28} className="text-gray-400" />}
        {status === "in_progress" && <Clock size={28} className="text-blue-400" />}
        {status === "completed" && <CheckCircle size={28} className="text-green-500" />}
      </button>
      <input
        type="text"
        className={`w-full rounded px-3 py-2 border border-gray-300 focus:outline-none focus:ring focus:ring-pink-200 transition-colors duration-300 ${
          status === "completed" ? "line-through text-gray-400" : ""
        }`}
        placeholder={t('taskPlaceholder')}
        value={value}
        maxLength={100}
        onChange={e => onChange(e.target.value)}
        aria-label={t('taskInputAria')}
        disabled={status === "completed"}
      />
    </div>
  );
}
