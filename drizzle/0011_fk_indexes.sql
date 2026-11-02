CREATE INDEX "admission_request_user" ON "admission_request" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "meeting_member_user" ON "meeting_member" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "meeting_notes_saved_by" ON "meeting_notes" USING btree ("saved_by");--> statement-breakpoint
CREATE INDEX "meeting_session_meeting" ON "meeting_session" USING btree ("meeting_id","started_at");--> statement-breakpoint
CREATE INDEX "participant_session_user" ON "participant_session" USING btree ("user_id");