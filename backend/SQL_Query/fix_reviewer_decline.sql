-- Fix: Allow reviewers to update journal status when declining an assignment
-- The trigger trg_enforce_journal_file_url_ownership was blocking reviewers from
-- declining assignments because it ran during the status UPDATE in reviewer_respond_to_assignment.
-- Reviewers are now added to the bypass list (alongside admins and service_role).

CREATE OR REPLACE FUNCTION public.enforce_journal_file_url_ownership()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Service role (backend), Admins, and Reviewers can bypass this restriction
  -- Reviewers need to update journal status when declining assignments (via SECURITY DEFINER RPC)
  IF current_setting('role', true) = 'service_role'
     OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'reviewer')) THEN
    RETURN NEW;
  END IF;

  -- Only check file_url ownership if file_url is being inserted or modified
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.file_url IS DISTINCT FROM OLD.file_url) THEN
    IF NEW.file_url IS NOT NULL AND NEW.file_url NOT LIKE (NEW.student_id::text || '/%') AND NEW.file_url NOT LIKE (auth.uid()::text || '/%') THEN
      RAISE EXCEPTION 'Forbidden: file_url must belong to your own storage folder';
    END IF;
  END IF;

  -- Prevent students from forging revision/approval URLs on update
  IF TG_OP = 'UPDATE' THEN
    IF NEW.revision_report_url IS DISTINCT FROM OLD.revision_report_url AND NEW.revision_report_url IS NOT NULL THEN
       IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'reviewer')) THEN
         RAISE EXCEPTION 'Forbidden: students cannot set revision_report_url';
       END IF;
    END IF;
    IF NEW.approval_proof_url IS DISTINCT FROM OLD.approval_proof_url AND NEW.approval_proof_url IS NOT NULL THEN
       IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
         RAISE EXCEPTION 'Forbidden: students cannot set approval_proof_url';
       END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
