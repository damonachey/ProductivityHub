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
                {MODULE_REGISTRY.map((definition) => (
                  <button
                    key={definition.type}
                    onClick={() => {
                      onAddModule(definition.type);
                      setPickerOpen(false);
                    }}
                  >
                    {definition.title}
                  </button>
                ))}
              </div>
            ) : (
              <button onClick={() => setPickerOpen(true)}>+ Add module</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
