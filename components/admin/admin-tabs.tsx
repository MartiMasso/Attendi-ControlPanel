"use client";

import { useState } from "react";

import { CreateAccountForm } from "@/components/forms/create-account-form";
import { CreateProductForm } from "@/components/forms/create-product-form";
import { EditProductForm } from "@/components/forms/edit-product-form";
import { EditProfileForm } from "@/components/forms/edit-profile-form";

const TABS = [
  { id: "create", label: "Create" },
  { id: "edit", label: "Edit" }
] as const;

type TabId = (typeof TABS)[number]["id"];

export function AdminTabs() {
  const [activeTab, setActiveTab] = useState<TabId>("create");

  return (
    <div className="space-y-5">
      {/* Tab bar */}
      <div className="flex gap-1 rounded-xl border border-border bg-surface-muted p-1 w-fit">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-lg px-5 py-1.5 text-sm font-medium transition ${
              activeTab === tab.id
                ? "bg-surface-elevated text-text shadow-sm"
                : "text-text-muted hover:text-text"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "create" && (
        <div className="grid gap-6 xl:grid-cols-2">
          <CreateAccountForm />
          <CreateProductForm />
        </div>
      )}

      {activeTab === "edit" && (
        <div className="grid gap-6 xl:grid-cols-2">
          <EditProfileForm />
          <EditProductForm />
        </div>
      )}
    </div>
  );
}
