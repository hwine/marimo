/* Copyright 2024 Marimo. All rights reserved. */
import React, { memo, useRef, useState } from "react";
import { CellRuntimeState } from "@/core/cells/types";
import { CellId, HTMLCellId } from "@/core/cells/ids";
import { OutputArea } from "@/components/editor/Output";
import { ICellRendererPlugin, ICellRendererProps } from "../types";
import { VerticalLayoutWrapper } from "./vertical-layout-wrapper";
import { z } from "zod";
import { useDelayVisibility } from "./useDelayVisibility";
import { AppMode, kioskModeAtom } from "@/core/mode";
import { ReadonlyPythonCode } from "@/components/editor/code/readonly-python-code";
import {
  ChevronDown,
  Code2Icon,
  Download,
  FolderDownIcon,
  ImageIcon,
} from "lucide-react";
import { cn } from "@/utils/cn";
import { Button } from "@/components/ui/button";
import { outputIsStale } from "@/core/cells/cell";
import { isStaticNotebook } from "@/core/static/static-state";
import { ConsoleOutput } from "@/components/editor/output/ConsoleOutput";
import {
  DropdownMenuItem,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { downloadHTMLAsImage } from "@/utils/download";
import { downloadAsHTML } from "@/core/static/download-html";
import { isPyodide } from "@/core/pyodide/utils";
import { CellConfig } from "@/core/network/types";
import { useAtomValue } from "jotai";

type VerticalLayout = null;
type VerticalLayoutProps = ICellRendererProps<VerticalLayout>;

const VerticalLayoutRenderer: React.FC<VerticalLayoutProps> = ({
  cells,
  appConfig,
  mode,
}) => {
  const { invisible } = useDelayVisibility(cells.length, mode);
  const kioskMode = useAtomValue(kioskModeAtom);

  const urlParams = new URLSearchParams(window.location.search);
  const showCodeDefault = urlParams.get("show-code");
  const [showCode, setShowCode] = useState(() => {
    // Default to showing code if the notebook is static
    return showCodeDefault === null
      ? isStaticNotebook() || isPyodide()
      : showCodeDefault === "true";
  });

  const evaluateCanShowCode = () => {
    const cellsHaveCode = cells.some((cell) => Boolean(cell.code));

    if (kioskMode) {
      return true;
    }

    // Only show code if in read mode and there is at least one cell with code

    // If it is a static-notebook or wasm-read-only-notebook, code is always included,
    // but it can be turned it off via a query parameter (include-code=false)

    const includeCode = urlParams.get("include-code");
    return mode === "read" && includeCode !== "false" && cellsHaveCode;
  };

  const canShowCode = evaluateCanShowCode();

  return (
    <VerticalLayoutWrapper invisible={invisible} appConfig={appConfig}>
      {cells.map((cell) => (
        <VerticalCell
          key={cell.id}
          cellId={cell.id}
          output={cell.output}
          consoleOutputs={cell.consoleOutputs}
          status={cell.status}
          code={cell.code}
          config={cell.config}
          stopped={cell.stopped}
          showCode={showCode && canShowCode}
          errored={cell.errored}
          mode={mode}
          runStartTimestamp={cell.runStartTimestamp}
          interrupted={cell.interrupted}
          staleInputs={cell.staleInputs}
          name={cell.name}
          kiosk={kioskMode}
        />
      ))}
      {mode === "read" && (
        <ActionButtons
          canShowCode={canShowCode}
          showCode={showCode}
          onToggleShowCode={() => setShowCode((v) => !v)}
        />
      )}
    </VerticalLayoutWrapper>
  );
};

const ActionButtons: React.FC<{
  canShowCode: boolean;
  showCode: boolean;
  onToggleShowCode: () => void;
}> = ({ canShowCode, showCode, onToggleShowCode }) => {
  const handleDownloadAsPNG = async () => {
    const app = document.getElementById("App");
    if (!app) {
      return;
    }
    await downloadHTMLAsImage(app, document.title);
  };

  const handleDownloadAsHTML = async () => {
    const app = document.getElementById("App");
    if (!app) {
      return;
    }
    await downloadAsHTML({ filename: document.title });
  };

  return (
    <div
      className={cn(
        "right-0 top-0 z-50 m-4 no-print flex gap-2",
        // If the notebook is static, we have a banner at the top, so
        // we can't use fixed positioning. Ideally this is sticky, but the
        // current dom structure makes that difficult.
        isStaticNotebook() ? "absolute" : "fixed",
      )}
    >
      {canShowCode && (
        <Button
          variant="secondary"
          onClick={onToggleShowCode}
          size="xs"
          data-testid="show-code"
        >
          <Code2Icon className="w-4 h-4 mr-2" />
          {showCode ? "Hide code" : "Show code"}
        </Button>
      )}
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild={true}>
          <Button variant="secondary" size="xs" data-testid="download-as">
            <Download className="w-4 h-4 mr-2" />
            Download as
            <ChevronDown className="w-4 h-4 ml-2" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="no-print w-[220px]">
          <DropdownMenuItem onSelect={handleDownloadAsHTML}>
            <FolderDownIcon className="mr-2" size={14} strokeWidth={1.5} />
            Download as HTML
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={handleDownloadAsPNG}>
            <ImageIcon className="mr-2" size={14} strokeWidth={1.5} />
            Download as PNG
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

interface VerticalCellProps
  extends Pick<
    CellRuntimeState,
    | "output"
    | "consoleOutputs"
    | "status"
    | "stopped"
    | "errored"
    | "interrupted"
    | "staleInputs"
    | "runStartTimestamp"
  > {
  cellId: CellId;
  config: CellConfig;
  code: string;
  mode: AppMode;
  showCode: boolean;
  name: string;
  kiosk: boolean;
}

const VerticalCell = memo(
  ({
    output,
    consoleOutputs,
    cellId,
    status,
    stopped,
    errored,
    config,
    interrupted,
    staleInputs,
    runStartTimestamp,
    code,
    showCode,
    mode,
    name,
    kiosk,
  }: VerticalCellProps) => {
    const cellRef = useRef<HTMLDivElement>(null);

    const outputStale = outputIsStale(
      {
        status,
        output,
        interrupted,
        runStartTimestamp,
        staleInputs,
      },
      false,
    );

    // Kiosk and not presenting
    const kioskFull = kiosk && mode !== "present";

    const className = cn("Cell", "hover-actions-parent", {
      published: !showCode && !kioskFull,
      interactive: mode === "edit",
      "has-error": errored,
      stopped: stopped,
    });

    const HTMLId = HTMLCellId.create(cellId);

    // Read mode and show code
    if ((mode === "read" && showCode) || kioskFull) {
      return (
        <div tabIndex={-1} id={HTMLId} ref={cellRef} className={className}>
          <OutputArea
            allowExpand={true}
            output={output}
            className="output-area"
            cellId={cellId}
            stale={outputStale}
          />
          <div className="tray">
            <ReadonlyPythonCode
              initiallyHideCode={config.hide_code || kiosk}
              code={code}
            />
          </div>
          <ConsoleOutput
            consoleOutputs={consoleOutputs}
            stale={outputStale}
            cellName={name}
            onSubmitDebugger={() => null}
            cellId={cellId}
            debuggerActive={false}
          />
        </div>
      );
    }

    const hidden = errored || interrupted || stopped;

    return hidden ? null : (
      <div tabIndex={-1} id={HTMLId} ref={cellRef} className={className}>
        <OutputArea
          allowExpand={mode === "edit"}
          output={output}
          className="output-area"
          cellId={cellId}
          stale={outputStale}
        />
      </div>
    );
  },
);
VerticalCell.displayName = "VerticalCell";

export const VerticalLayoutPlugin: ICellRendererPlugin<
  VerticalLayout,
  VerticalLayout
> = {
  type: "vertical",
  name: "Vertical",
  validator: z.any(),
  Component: VerticalLayoutRenderer,
  deserializeLayout: (serialized) => serialized,
  serializeLayout: (layout) => layout,
  getInitialLayout: () => null,
};
