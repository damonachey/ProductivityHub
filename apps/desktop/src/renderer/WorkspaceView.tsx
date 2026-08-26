import { useState } from "react";
import type { Workspace } from "../types";
import { MODULE_REGISTRY, getModuleDefinition } from "./modules/registry";

interface Props {
  workspace: Workspace;
  onAddModule: (type: string) => void;
  onRemoveModule: (moduleId: string) => void;
  lockLayout: boolean;
}

export function WorkspaceView({ workspace, onAddModule, onRemoveModule, lockLayout }: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredModules = MODULE_REGISTRY.filter((definition) =>
    definition.title.toLowerCase().includes(searchQuery.trim().toLowerCase()),
  );

  return (
    <div className="workspace-view">
      <div className="module-grid">
        {workspace.modules.map((moduleInstance) => {
          const definition = getModuleDefinition(moduleInstance.type);
          if (!definition) return null;
          const { Component } = definition;

          return (
            <div className="module-card" key={moduleInstance.id}>
              <div className="module-card-header">
                <span>{definition.title}</span>
                {!lockLayout && (
                  <button
                    aria-label={`Remove ${definition.title}`}
                    onClick={() => onRemoveModule(moduleInstance.id)}
                  >
                    ×
                  </button>
                )}
              </div>
              <div className="module-card-body">
                <Component />
              </div>
            </div>
          );
        })}

        {!lockLayout && (
          <div className="module-card module-card-add">
            {pickerOpen ? (
              <div className="module-picker">
                <input
                  className="module-picker-search"
                  type="text"
                  placeholder="Search modules…"
                  autoFocus
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") setPickerOpen(false);
                  }}
                />
                {filteredModules.length > 0 ? (
                  filteredModules.map((definition) => (
                    <button
                      key={definition.type}
                      onClick={() => {
                        onAddModule(definition.type);
                        setPickerOpen(false);
                      }}
                    >
                      {definition.title}
                    </button>
                  ))
                ) : (
                  <p className="module-picker-empty">No modules match "{searchQuery}".</p>
                )}
              </div>
            ) : (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setPickerOpen(true);
                }}
              >
                + Add module
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
