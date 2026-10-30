"use client";

import { useActionState, useRef, useState } from "react";
import { startGeneration, type FormState } from "../../actions";
import { GenerationRequest } from "@/lib/generation-request";

export function useGenerationAction(initialRequestId: string, onSuccess?: () => void) {
  const [requestId, setRequestId] = useState(initialRequestId);
  const requests = useRef<GenerationRequest | null>(null);
  const [state, action, pending] = useActionState(
    async (prev: FormState, form: FormData): Promise<FormState> => {
      requests.current ??= new GenerationRequest();
      form.set("requestId", requests.current.forForm(form));
      const result = await startGeneration(prev, form);
      if (!result.error) {
        setRequestId(crypto.randomUUID());
        onSuccess?.();
      }
      return result;
    },
    { error: null },
  );
  return { state, action, pending, requestId };
}
