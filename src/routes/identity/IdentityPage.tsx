import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type KeyboardEvent,
} from "react";
import { useNavigate } from "@tanstack/react-router";
import { Download, FileJson, Upload } from "lucide-react";
import { professionalIdentityToResumeData } from "../../identity/resumeAdapter";
import { useIdentityStore } from "../../store/identityStore";
import { useResumeStore } from "../../store/resumeStore";
import { useUiStore } from "../../store/uiStore";
import { type IdentityApplyMode } from "../../types/identity";
import { facetClientEnv } from "../../utils/facetEnv";
import { sanitizeEndpointUrl } from "../../utils/idUtils";
import {
  deepenIdentityBullet,
  generateIdentityDraft,
  parseIdentityExtractionResponse,
} from "../../utils/identityExtraction";
import { scanResumePdf } from "../../utils/resumeScanner";
import {
  resolveComparisonVectorAfterReplaceImport,
  resolveSelectedVectorAfterReplaceImport,
} from "../../utils/importSelection";
import { parseJsonWithRepair } from "../../utils/jsonParsing";
import {
  findNextPendingIdentitySkill,
  getIdentityEnrichmentProgress,
} from "../../utils/identityEnrichment";
import { BulletConfidenceCard } from "./BulletConfidenceCard";
import { DraftSummaryCard } from "./DraftSummaryCard";
import { ExtractionAgentCard } from "./ExtractionAgentCard";
import { IdentityModelBuilderCard } from "./IdentityModelBuilderCard";
import { IdentityStrategyWorkbench } from "./IdentityStrategyWorkbench";
import "./identity.css";

const downloadJson = (filename: string, content: string) => {
  const blob = new Blob([content], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  globalThis.setTimeout(() => URL.revokeObjectURL(url), 60_000);
};

type IdentityWorkspaceTab = "model" | "strategy";
type IdentityPrimaryAction =
  | "upload"
  | "generate"
  | "reviewDraft"
  | "continueEnrichment"
  | "pushToBuild";

const assertNever = (value: never): never => {
  throw new Error(`Unexpected identity action: ${String(value)}`);
};

export function IdentityPage() {
  const navigate = useNavigate();
  const importRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const primaryActionButtonRef = useRef<HTMLButtonElement>(null);
  const draftSectionRef = useRef<HTMLDivElement>(null);
  const generateAbortRef = useRef<AbortController | null>(null);
  const scanAbortRef = useRef<AbortController | null>(null);
  // Single-bullet and bulk deepening are intentionally mutually exclusive in the UI.
  const deepenAbortRef = useRef<AbortController | null>(null);
  const [activeWorkspace, setActiveWorkspace] =
    useState<IdentityWorkspaceTab>("model");
  const [pendingModelScrollTarget, setPendingModelScrollTarget] = useState<
    "draft" | null
  >(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [pageNotice, setPageNotice] = useState<string | null>(null);
  const intakeMode = useIdentityStore((state) => state.intakeMode);
  const sourceMaterial = useIdentityStore((state) => state.sourceMaterial);
  const correctionNotes = useIdentityStore((state) => state.correctionNotes);
  const currentIdentity = useIdentityStore((state) => state.currentIdentity);
  const draft = useIdentityStore((state) => state.draft);
  const draftDocument = useIdentityStore((state) => state.draftDocument);
  const scanResult = useIdentityStore((state) => state.scanResult);
  const warnings = useIdentityStore((state) => state.warnings);
  const changelog = useIdentityStore((state) => state.changelog);
  const setIntakeMode = useIdentityStore((state) => state.setIntakeMode);
  const setSourceMaterial = useIdentityStore(
    (state) => state.setSourceMaterial,
  );
  const setCorrectionNotes = useIdentityStore(
    (state) => state.setCorrectionNotes,
  );
  const setDraft = useIdentityStore((state) => state.setDraft);
  const setDraftDocument = useIdentityStore((state) => state.setDraftDocument);
  const setScanResult = useIdentityStore((state) => state.setScanResult);
  const updateScannedIdentityCore = useIdentityStore(
    (state) => state.updateScannedIdentityCore,
  );
  const updateScannedRole = useIdentityStore(
    (state) => state.updateScannedRole,
  );
  const updateScannedBulletSourceText = useIdentityStore(
    (state) => state.updateScannedBulletSourceText,
  );
  const updateScannedBulletTextField = useIdentityStore(
    (state) => state.updateScannedBulletTextField,
  );
  const updateScannedBulletListField = useIdentityStore(
    (state) => state.updateScannedBulletListField,
  );
  const updateScannedBulletMetrics = useIdentityStore(
    (state) => state.updateScannedBulletMetrics,
  );
  const startScannedBulletDeepen = useIdentityStore(
    (state) => state.startScannedBulletDeepen,
  );
  const completeScannedBulletDeepen = useIdentityStore(
    (state) => state.completeScannedBulletDeepen,
  );
  const failScannedBulletDeepen = useIdentityStore(
    (state) => state.failScannedBulletDeepen,
  );
  const startScanBulkDeepen = useIdentityStore(
    (state) => state.startScanBulkDeepen,
  );
  const updateScanBulkProgress = useIdentityStore(
    (state) => state.updateScanBulkProgress,
  );
  const requestCancelScanBulkDeepen = useIdentityStore(
    (state) => state.requestCancelScanBulkDeepen,
  );
  const finishScanBulkDeepen = useIdentityStore(
    (state) => state.finishScanBulkDeepen,
  );
  const updateScannedSkillGroupLabel = useIdentityStore(
    (state) => state.updateScannedSkillGroupLabel,
  );
  const updateScannedSkillItemName = useIdentityStore(
    (state) => state.updateScannedSkillItemName,
  );
  const updateScannedProjectEntry = useIdentityStore(
    (state) => state.updateScannedProjectEntry,
  );
  const updateScannedEducationEntry = useIdentityStore(
    (state) => state.updateScannedEducationEntry,
  );
  const importIdentity = useIdentityStore((state) => state.importIdentity);
  const applyDraft = useIdentityStore((state) => state.applyDraft);
  const selectedVector = useUiStore((state) => state.selectedVector);
  const comparisonVector = useUiStore((state) => state.comparisonVector);
  const setSelectedVector = useUiStore((state) => state.setSelectedVector);
  const setComparisonVector = useUiStore((state) => state.setComparisonVector);
  const setData = useResumeStore((state) => state.setData);

  const aiEndpoint = useMemo(
    () => sanitizeEndpointUrl(facetClientEnv.anthropicProxyUrl),
    [],
  );

  useEffect(
    () => () => {
      generateAbortRef.current?.abort();
      scanAbortRef.current?.abort();
      deepenAbortRef.current?.abort();
    },
    [],
  );

  useEffect(() => {
    if (!currentIdentity && activeWorkspace === "strategy") {
      setActiveWorkspace("model");
      primaryActionButtonRef.current?.focus();
    }
  }, [activeWorkspace, currentIdentity]);

  useEffect(() => {
    if (activeWorkspace !== "model" || pendingModelScrollTarget !== "draft") {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      draftSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      setPendingModelScrollTarget(null);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [activeWorkspace, pendingModelScrollTarget]);

  const counts = useMemo(() => {
    const identity = draft?.identity ?? currentIdentity ?? null;
    if (!identity) {
      return null;
    }

    const bulletCount = identity.roles.reduce(
      (total, role) => total + role.bullets.length,
      0,
    );
    return {
      roles: identity.roles.length,
      bullets: bulletCount,
      profiles: identity.profiles.length,
      projects: identity.projects.length,
      skillGroups: identity.skills.groups.length,
    };
  }, [currentIdentity, draft]);

  const enrichmentProgress = useMemo(
    () =>
      currentIdentity ? getIdentityEnrichmentProgress(currentIdentity) : null,
    [currentIdentity],
  );
  const nextEnrichmentSkill = useMemo(
    () =>
      currentIdentity ? findNextPendingIdentitySkill(currentIdentity) : null,
    [currentIdentity],
  );

  const scanCompletion = useMemo(() => {
    if (!scanResult) {
      return null;
    }
    return {
      extractedBullets: scanResult.counts.extractedBullets,
      decomposedBullets:
        scanResult.counts.deepenedBullets + scanResult.counts.editedBullets,
    };
  }, [scanResult]);

  const bulkStatus = scanResult?.progress.bulk.status ?? null;
  const hasSourceMaterial = useMemo(
    () => sourceMaterial.trim().length > 0 || Boolean(scanResult),
    [scanResult, sourceMaterial],
  );
  const availableWorkspaces: IdentityWorkspaceTab[] = currentIdentity
    ? ["model", "strategy"]
    : ["model"];

  const ensureEndpoint = () => {
    if (!aiEndpoint) {
      throw new Error(
        "Identity extraction is disabled. Configure VITE_ANTHROPIC_PROXY_URL.",
      );
    }
  };

  const runGenerate = async (mode: "fresh" | "regenerate") => {
    const shouldUseScan = intakeMode === "upload" && Boolean(scanResult);
    const effectiveSourceMaterial = shouldUseScan
      ? (scanResult?.rawText ?? "")
      : sourceMaterial;
    let controller: AbortController | null = null;

    if (!effectiveSourceMaterial.trim()) {
      setPageNotice(null);
      setPageError("Source material is required before generating a draft.");
      return;
    }

    try {
      generateAbortRef.current?.abort();
      controller = new AbortController();
      generateAbortRef.current = controller;
      ensureEndpoint();
      setPageError(null);
      setPageNotice(null);
      setIsGenerating(true);
      const nextDraft = await generateIdentityDraft({
        endpoint: aiEndpoint,
        sourceMaterial: effectiveSourceMaterial,
        correctionNotes,
        seedIdentity: shouldUseScan ? (scanResult?.identity ?? null) : null,
        existingDraft:
          mode === "regenerate" ? (draft?.identity ?? currentIdentity) : null,
        signal: controller.signal,
      });
      if (controller.signal.aborted) {
        return;
      }
      setDraft(nextDraft);
      setPageNotice(
        mode === "regenerate"
          ? "Regenerated the draft with the latest correction notes."
          : "Generated a new Professional Identity draft.",
      );
    } catch (error) {
      if (controller?.signal.aborted && error instanceof DOMException) {
        return;
      }
      setPageNotice(null);
      setPageError(
        error instanceof Error
          ? error.message
          : "Identity draft generation failed.",
      );
    } finally {
      if (
        controller &&
        generateAbortRef.current === controller &&
        !controller.signal.aborted
      ) {
        setIsGenerating(false);
      }
      if (controller && generateAbortRef.current === controller) {
        generateAbortRef.current = null;
      }
    }
  };

  const handleScannedFile = async (file: File) => {
    if (!/\.pdf$/i.test(file.name)) {
      setPageNotice(null);
      setPageError("Resume Scanner v1 only supports PDF uploads.");
      return;
    }

    let controller: AbortController | null = null;
    try {
      deepenAbortRef.current?.abort();
      scanAbortRef.current?.abort();
      controller = new AbortController();
      scanAbortRef.current = controller;
      setIsScanning(true);
      setPageError(null);
      setPageNotice(null);
      const result = await scanResumePdf(file, { signal: controller.signal });
      if (controller.signal.aborted) {
        return;
      }
      setSourceMaterial(result.rawText);

      if (result.identity.roles.length === 0) {
        setScanResult(null);
        setIntakeMode("paste");
        setPageNotice(
          result.warnings.find(
            (warning) => warning.code === "role-parse-fallback",
          )?.message ??
            "Resume text extraction succeeded, but structural role parsing failed. The raw text is now loaded into paste-text mode.",
        );
        return;
      }

      setScanResult(result);
      setIntakeMode("upload");
      setPageNotice(`Scanned ${file.name} into a structured identity shell.`);
    } catch (error) {
      if (controller?.signal.aborted && error instanceof DOMException) {
        return;
      }
      setPageNotice(null);
      setPageError(
        error instanceof Error ? error.message : "Resume scan failed.",
      );
    } finally {
      if (
        controller &&
        scanAbortRef.current === controller &&
        !controller.signal.aborted
      ) {
        setIsScanning(false);
      }
      if (controller && scanAbortRef.current === controller) {
        scanAbortRef.current = null;
      }
    }
  };

  const handleUploadChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    await handleScannedFile(file);
    event.target.value = "";
  };

  const handleRequestUpload = () => {
    setIntakeMode("upload");
    uploadRef.current?.click();
  };

  const handleContinueSkillEnrichment = () => {
    void navigate(
      nextEnrichmentSkill
        ? {
            to: "/identity/enrich/$groupId/$skillName",
            params: {
              groupId: nextEnrichmentSkill.groupId,
              skillName: nextEnrichmentSkill.skillName,
            },
          }
        : {
            to: "/identity/enrich",
          },
    );
  };

  const handleDrop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIntakeMode("upload");
    const file = event.dataTransfer.files?.[0];
    if (!file) {
      return;
    }

    await handleScannedFile(file);
  };

  const handleDeepenBullet = async (roleId: string, bulletId: string) => {
    const liveScan = useIdentityStore.getState().scanResult;
    if (!liveScan) {
      return;
    }

    if (
      Object.values(liveScan.progress.bullets).some(
        (progress) => progress.status === "running",
      )
    ) {
      return;
    }

    const targetRole = liveScan.identity.roles.find(
      (role) => role.id === roleId,
    );
    const targetBullet = targetRole?.bullets.find(
      (bullet) => bullet.id === bulletId,
    );
    if (!targetBullet?.source_text?.trim()) {
      setPageNotice(null);
      setPageError("Add source text to the bullet before deepening it.");
      return;
    }

    let controller: AbortController | null = null;
    try {
      deepenAbortRef.current?.abort();
      controller = new AbortController();
      deepenAbortRef.current = controller;
      ensureEndpoint();
      setPageError(null);
      setPageNotice(null);
      startScannedBulletDeepen(roleId, bulletId);
      const result = await deepenIdentityBullet({
        endpoint: aiEndpoint,
        identity:
          useIdentityStore.getState().scanResult?.identity ?? liveScan.identity,
        roleId,
        bulletId,
        correctionNotes,
        signal: controller.signal,
      });
      if (controller.signal.aborted) {
        return;
      }

      completeScannedBulletDeepen(result);
      setPageNotice(result.summary);
    } catch (error) {
      if (controller?.signal.aborted && error instanceof DOMException) {
        return;
      }

      const message =
        error instanceof Error ? error.message : "Bullet deepening failed.";
      failScannedBulletDeepen(roleId, bulletId, message);
      setPageNotice(null);
      setPageError(message);
    } finally {
      if (controller && deepenAbortRef.current === controller) {
        deepenAbortRef.current = null;
      }
    }
  };

  const handleDeepenAll = async () => {
    const liveScan = useIdentityStore.getState().scanResult;
    if (!liveScan) {
      return;
    }
    const scanSessionId = liveScan.scannedAt;
    const isSameScanSession = () =>
      useIdentityStore.getState().scanResult?.scannedAt === scanSessionId;

    if (
      Object.values(liveScan.progress.bullets).some(
        (progress) => progress.status === "running",
      )
    ) {
      setPageNotice(null);
      setPageError(
        "Wait for the current bullet deepening run to finish before starting Deepen All.",
      );
      return;
    }

    try {
      ensureEndpoint();
      setPageError(null);
      setPageNotice(null);
    } catch (error) {
      setPageNotice(null);
      setPageError(
        error instanceof Error
          ? error.message
          : "Identity extraction is disabled.",
      );
      return;
    }

    startScanBulkDeepen();

    let completed = 0;
    let failed = 0;
    const pendingBullets = liveScan.identity.roles.flatMap((role) =>
      role.bullets
        .filter((bullet) => Boolean(bullet.source_text?.trim()))
        .map((bullet) => ({
          roleId: role.id,
          bulletId: bullet.id,
        })),
    );

    for (const target of pendingBullets) {
      if (!isSameScanSession()) {
        return;
      }

      const currentScan = useIdentityStore.getState().scanResult;
      if (!currentScan) {
        break;
      }

      const progress =
        currentScan.progress.bullets[`${target.roleId}::${target.bulletId}`];
      if (
        progress?.status === "completed" ||
        progress?.status === "edited" ||
        progress?.status === "running"
      ) {
        continue;
      }

      if (currentScan.progress.bulk.status === "cancelling") {
        break;
      }

      let controller: AbortController | null = null;
      try {
        updateScanBulkProgress(`${target.roleId}::${target.bulletId}`);
        startScannedBulletDeepen(target.roleId, target.bulletId);
        controller = new AbortController();
        deepenAbortRef.current = controller;
        const result = await deepenIdentityBullet({
          endpoint: aiEndpoint,
          identity:
            useIdentityStore.getState().scanResult?.identity ??
            currentScan.identity,
          roleId: target.roleId,
          bulletId: target.bulletId,
          correctionNotes,
          signal: controller.signal,
        });
        if (controller.signal.aborted) {
          break;
        }
        if (!isSameScanSession()) {
          return;
        }

        completeScannedBulletDeepen(result);
        completed += 1;
      } catch (error) {
        if (
          controller?.signal.aborted &&
          useIdentityStore.getState().scanResult?.progress.bulk.status ===
            "cancelling"
        ) {
          break;
        }

        if (controller?.signal.aborted && error instanceof DOMException) {
          break;
        }

        const message =
          error instanceof Error ? error.message : "Bullet deepening failed.";
        if (!isSameScanSession()) {
          return;
        }
        failScannedBulletDeepen(target.roleId, target.bulletId, message);
        failed += 1;
      } finally {
        if (controller && deepenAbortRef.current === controller) {
          deepenAbortRef.current = null;
        }
      }
    }

    if (!isSameScanSession()) {
      return;
    }

    if (!useIdentityStore.getState().scanResult) {
      return;
    }

    const finalStatus =
      useIdentityStore.getState().scanResult?.progress.bulk.status;
    finishScanBulkDeepen();
    setPageNotice(
      finalStatus === "cancelling"
        ? `Stopped bulk deepening after completing ${completed} bullet(s).`
        : failed > 0
          ? `Deepened ${completed} scanned bullet(s); ${failed} failed.`
          : `Deepened ${completed} scanned bullet(s).`,
    );
  };

  const handleCancelDeepenAll = () => {
    requestCancelScanBulkDeepen();
    deepenAbortRef.current?.abort();
  };

  const handleValidateDraft = () => {
    try {
      const parsedDraft = parseJsonWithRepair(
        draftDocument,
        "Draft identity document",
      );
      const parsed = parseIdentityExtractionResponse(
        JSON.stringify({
          summary: draft?.summary ?? "Manual draft validation",
          follow_up_questions: draft?.followUpQuestions ?? [],
          identity: parsedDraft.data,
          bullets:
            draft?.bullets.map((bullet) => ({
              role_id: bullet.roleId,
              bullet_id: bullet.bulletId,
              rewrite: bullet.rewrite,
              tags: bullet.tags,
              assumptions: bullet.assumptions,
            })) ?? [],
        }),
      );
      setDraft(parsed);
      setPageError(null);
      setPageNotice(
        parsedDraft.repaired
          ? "Validated the current draft JSON against the identity schema and repaired minor syntax issues."
          : "Validated the current draft JSON against the identity schema.",
      );
    } catch (error) {
      setPageNotice(null);
      setPageError(
        error instanceof Error ? error.message : "Draft validation failed.",
      );
    }
  };

  const handleApply = (mode: IdentityApplyMode) => {
    if (mode === "replace" && currentIdentity) {
      const confirmed = window.confirm(
        "Replace the current identity model with the draft? This overwrites the existing model.",
      );
      if (!confirmed) {
        return;
      }
    }

    try {
      const result = applyDraft(mode);
      setPageError(null);
      setPageNotice(result.summary);
    } catch (error) {
      setPageNotice(null);
      setPageError(
        error instanceof Error
          ? error.message
          : "Unable to apply the current draft.",
      );
    }
  };

  const handleImportJson = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const parsed = parseJsonWithRepair<unknown>(
        await file.text(),
        "Imported identity JSON",
      );
      const result = importIdentity(
        parsed.data,
        "Imported identity model from JSON",
      );
      setPageError(null);
      setPageNotice(
        parsed.repaired
          ? `${result.summary}. Repaired minor JSON syntax issues during import.`
          : result.summary,
      );
    } catch (error) {
      setPageNotice(null);
      setPageError(
        error instanceof Error
          ? error.message
          : "Unable to import identity JSON.",
      );
    } finally {
      event.target.value = "";
    }
  };

  const handleExportCurrent = () => {
    if (!currentIdentity) {
      setPageNotice(null);
      setPageError("Apply or import an identity model before exporting it.");
      return;
    }

    downloadJson("identity.json", JSON.stringify(currentIdentity, null, 2));
    setPageError(null);
    setPageNotice("Exported the current identity model.");
  };

  const handleExportDraft = () => {
    if (!draftDocument.trim()) {
      setPageNotice(null);
      setPageError("Generate or import a draft before exporting it.");
      return;
    }

    downloadJson("identity-draft.json", draftDocument);
    setPageError(null);
    setPageNotice("Exported the current draft document.");
  };

  const handlePushToBuild = () => {
    if (!currentIdentity) {
      setPageNotice(null);
      setPageError(
        "Apply the draft to the identity model before pushing it into Build.",
      );
      return;
    }

    const confirmed = window.confirm(
      "Replace the Build workspace with data derived from this identity model? Existing overrides, presets, and bullet orders will be lost.",
    );
    if (!confirmed) {
      return;
    }

    const adapted = professionalIdentityToResumeData(currentIdentity);
    setData(adapted.data);
    setSelectedVector(
      resolveSelectedVectorAfterReplaceImport(
        selectedVector,
        adapted.data.vectors,
      ),
    );
    setComparisonVector(
      resolveComparisonVectorAfterReplaceImport(
        comparisonVector,
        adapted.data.vectors,
      ),
    );
    setPageError(null);
    setPageNotice(
      adapted.warnings.length > 0
        ? `Sent the current identity model to Build. ${adapted.warnings.join(" ")}`
        : "Sent the current identity model to Build.",
    );
    void navigate({ to: "/build" });
  };

  const scrollToDraftSection = () => {
    setPendingModelScrollTarget("draft");
    // Ensure the model workspace is active before the deferred scroll runs.
    setActiveWorkspace("model");
  };

  const primaryActionState = useMemo<{
    action: IdentityPrimaryAction;
    label: string;
    status: string;
  }>(() => {
    if (isScanning) {
      return {
        action: "upload",
        label: "Scanning…",
        status: "Scanning the uploaded resume to prepare source material.",
      };
    }

    if (isGenerating) {
      return {
        action: "generate",
        label: "Generating…",
        status: "Generating a draft from your source material.",
      };
    }

    if (draft) {
      return {
        action: "reviewDraft",
        label: "Review Draft",
        status:
          "A draft is ready to review and apply to the current identity model.",
      };
    }

    if (currentIdentity) {
      const pending = enrichmentProgress?.pending ?? 0;
      if (pending > 0) {
        return {
          action: "continueEnrichment",
          label: "Continue Skill Enrichment",
          status: `${pending} skill${pending === 1 ? "" : "s"} still need enrichment before the model is fully shaped.`,
        };
      }

      return {
        action: "pushToBuild",
        label: "Send to Build",
        status:
          "Current identity is ready to use in Build or as the basis for search strategy.",
      };
    }

    if (hasSourceMaterial) {
      return {
        action: "generate",
        label: "Generate Draft",
        status:
          "Source material is loaded. Generate a draft when you are ready.",
      };
    }

    return {
      action: "upload",
      label: "Upload Resume",
      status:
        "Upload a resume or paste source material to start building the identity model.",
    };
  }, [
    currentIdentity,
    draft,
    enrichmentProgress?.pending,
    hasSourceMaterial,
    isGenerating,
    isScanning,
  ]);

  const {
    action: primaryAction,
    label: primaryActionLabel,
    status: headerStatus,
  } = primaryActionState;
  const isPrimaryActionDisabled = isGenerating || isScanning;

  const handlePrimaryAction = () => {
    switch (primaryAction) {
      case "continueEnrichment":
        handleContinueSkillEnrichment();
        break;
      case "generate":
        void runGenerate("fresh");
        break;
      case "pushToBuild":
        handlePushToBuild();
        break;
      case "reviewDraft":
        scrollToDraftSection();
        break;
      case "upload":
        handleRequestUpload();
        break;
      default:
        assertNever(primaryAction);
    }
  };

  const handleWorkspaceTabKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    tab: IdentityWorkspaceTab,
  ) => {
    const currentIndex = availableWorkspaces.indexOf(tab);
    if (currentIndex === -1) {
      return;
    }

    let nextTab: IdentityWorkspaceTab | null = null;
    if (event.key === "ArrowRight") {
      nextTab =
        availableWorkspaces[(currentIndex + 1) % availableWorkspaces.length] ??
        null;
    } else if (event.key === "ArrowLeft") {
      nextTab =
        availableWorkspaces[
          (currentIndex - 1 + availableWorkspaces.length) %
            availableWorkspaces.length
        ] ?? null;
    } else if (event.key === "Home") {
      nextTab = availableWorkspaces[0] ?? null;
    } else if (event.key === "End") {
      nextTab = availableWorkspaces[availableWorkspaces.length - 1] ?? null;
    }

    if (!nextTab) {
      return;
    }

    event.preventDefault();
    setActiveWorkspace(nextTab);
    const nextButton = document.getElementById(
      `identity-workspace-${nextTab}-tab`,
    );
    if (nextButton instanceof HTMLButtonElement) {
      nextButton.focus();
    }
  };

  return (
    <div className="identity-page">
      <header className="identity-header identity-header-sticky">
        <div className="identity-header-main">
          <p className="identity-eyebrow">Phase 0</p>
          <h1>Professional Identity</h1>
          <p className="identity-copy">
            Build the write-layer and extraction loop for identity.json: draft
            from raw source material, correct it, validate it, then push the
            resulting model into Build.
          </p>
          <p className="identity-header-status" aria-live="polite">
            {headerStatus}
          </p>
        </div>

        <div className="identity-header-controls">
          {availableWorkspaces.length > 1 ? (
            <div
              className="identity-tabs identity-workspace-tabs"
              role="tablist"
              aria-label="Identity workspaces"
            >
              <button
                id="identity-workspace-model-tab"
                type="button"
                role="tab"
                aria-selected={activeWorkspace === "model"}
                aria-controls="identity-workspace-model"
                tabIndex={activeWorkspace === "model" ? 0 : -1}
                className={`identity-tab ${activeWorkspace === "model" ? "active" : ""}`}
                onClick={() => setActiveWorkspace("model")}
                onKeyDown={(event) => handleWorkspaceTabKeyDown(event, "model")}
              >
                Model
              </button>
              <button
                id="identity-workspace-strategy-tab"
                type="button"
                role="tab"
                aria-selected={activeWorkspace === "strategy"}
                aria-controls="identity-workspace-strategy"
                tabIndex={activeWorkspace === "strategy" ? 0 : -1}
                className={`identity-tab ${activeWorkspace === "strategy" ? "active" : ""}`}
                onClick={() => setActiveWorkspace("strategy")}
                onKeyDown={(event) =>
                  handleWorkspaceTabKeyDown(event, "strategy")
                }
              >
                Strategy
              </button>
            </div>
          ) : null}

          <div className="identity-header-actions identity-header-actions-shell">
            <button
              ref={primaryActionButtonRef}
              className="identity-btn identity-btn-primary"
              type="button"
              onClick={handlePrimaryAction}
              disabled={isPrimaryActionDisabled}
              aria-busy={isPrimaryActionDisabled}
            >
              {primaryActionLabel}
            </button>
            <div className="identity-header-secondary-actions">
              <button
                className="identity-btn"
                type="button"
                onClick={() => importRef.current?.click()}
              >
                <Upload size={16} />
                Import JSON
              </button>
              <button
                className="identity-btn"
                type="button"
                onClick={handleExportDraft}
              >
                <Download size={16} />
                Export Draft
              </button>
              <button
                className="identity-btn"
                type="button"
                onClick={handleExportCurrent}
              >
                <FileJson size={16} />
                Export Identity
              </button>
            </div>
          </div>
          <input
            ref={importRef}
            hidden
            type="file"
            accept="application/json,.json"
            onChange={handleImportJson}
          />
        </div>
      </header>

      <div
        className={`identity-alert${pageError ? "" : " identity-message-empty"}`}
        role="alert"
        aria-live="assertive"
      >
        {pageError ?? ""}
      </div>
      <div
        className={`identity-notice${pageNotice ? "" : " identity-message-empty"}`}
        role="status"
        aria-live="polite"
      >
        {pageNotice ?? ""}
      </div>
      {warnings.length > 0 ? (
        <div className="identity-warning" role="alert">
          <strong>Warnings:</strong> {warnings.join(" ")}
        </div>
      ) : null}
      <div
        id="identity-workspace-model"
        role={availableWorkspaces.length > 1 ? "tabpanel" : undefined}
        aria-labelledby={
          availableWorkspaces.length > 1
            ? "identity-workspace-model-tab"
            : undefined
        }
        className="identity-workspace-panel"
        hidden={activeWorkspace !== "model" && Boolean(currentIdentity)}
      >
        <div className="identity-section-stack">
          {currentIdentity &&
          !draft &&
          enrichmentProgress &&
          enrichmentProgress.total > 0 ? (
            <section className="identity-card identity-enrichment-banner">
              <div className="identity-card-header">
                <div>
                  <h2>Skill Enrichment</h2>
                  <p>
                    Pending {enrichmentProgress.pending} · Complete{" "}
                    {enrichmentProgress.complete} · Skipped{" "}
                    {enrichmentProgress.skipped}
                  </p>
                </div>

                <div className="identity-card-actions">
                  <button
                    className="identity-btn identity-btn-primary"
                    type="button"
                    onClick={handleContinueSkillEnrichment}
                  >
                    Continue Skill Enrichment
                  </button>
                  {enrichmentProgress.pending === 0 ? (
                    <button
                      className="identity-btn"
                      type="button"
                      onClick={() => void navigate({ to: "/identity/enrich" })}
                    >
                      Review Enriched Skills
                    </button>
                  ) : null}
                </div>
              </div>
            </section>
          ) : null}

          <div className="identity-grid identity-grid-workbench">
            <ExtractionAgentCard
              intakeMode={intakeMode}
              sourceMaterial={sourceMaterial}
              correctionNotes={correctionNotes}
              currentIdentity={currentIdentity}
              draft={draft}
              scanResult={scanResult}
              scanCompletion={scanCompletion}
              bulkStatus={bulkStatus}
              isGenerating={isGenerating}
              isScanning={isScanning}
              uploadRef={uploadRef}
              onRequestUpload={handleRequestUpload}
              onSetIntakeMode={setIntakeMode}
              onSetSourceMaterial={setSourceMaterial}
              onSetCorrectionNotes={setCorrectionNotes}
              onGenerate={runGenerate}
              onDeepenAll={handleDeepenAll}
              onCancelDeepenAll={handleCancelDeepenAll}
              onUploadChange={handleUploadChange}
              onDrop={handleDrop}
              onClearScan={() => {
                deepenAbortRef.current?.abort();
                setScanResult(null);
                setPageNotice("Cleared the scanned resume structure.");
              }}
              onUpdateIdentityCore={updateScannedIdentityCore}
              onUpdateRole={updateScannedRole}
              onUpdateBulletSourceText={updateScannedBulletSourceText}
              onUpdateBulletTextField={updateScannedBulletTextField}
              onUpdateBulletListField={updateScannedBulletListField}
              onUpdateBulletMetrics={updateScannedBulletMetrics}
              onDeepenBullet={handleDeepenBullet}
              onUpdateSkillGroupLabel={updateScannedSkillGroupLabel}
              onUpdateSkillItemName={updateScannedSkillItemName}
              onUpdateProjectEntry={updateScannedProjectEntry}
              onUpdateEducationEntry={updateScannedEducationEntry}
            />

            <div ref={draftSectionRef}>
              <IdentityModelBuilderCard
                counts={counts}
                draftDocument={draftDocument}
                hasCurrentIdentity={Boolean(currentIdentity)}
                onSetDraftDocument={setDraftDocument}
                onValidateDraft={handleValidateDraft}
                onApply={handleApply}
              />
            </div>
          </div>

          <div className="identity-grid">
            <BulletConfidenceCard draft={draft} />
            <DraftSummaryCard draft={draft} changelog={changelog} />
          </div>
        </div>
      </div>

      {/* Strategy workspace requires a current identity model, so unmounting is intentional here. */}
      {currentIdentity ? (
        <div
          id="identity-workspace-strategy"
          role={availableWorkspaces.length > 1 ? "tabpanel" : undefined}
          aria-labelledby={
            availableWorkspaces.length > 1
              ? "identity-workspace-strategy-tab"
              : undefined
          }
          className="identity-workspace-panel"
          hidden={activeWorkspace !== "strategy"}
        >
          <IdentityStrategyWorkbench
            aiEndpoint={aiEndpoint}
            onError={setPageError}
            onNotice={setPageNotice}
          />
        </div>
      ) : null}
    </div>
  );
}
