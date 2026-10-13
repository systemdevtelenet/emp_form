# Employee submission setup

Copy `.env.example` to `.env.local`, set `SUPABASE_SECRET_KEY` to the CTNP System server secret key, and restart the development server. A legacy service-role key may instead be supplied as `SUPABASE_SERVICE_ROLE_KEY`. These values are used only on the server; no frontend key is needed.

Submit sends the form to `POST /api/employees`. The server validates all required fields, generates the employee name, combines address parts, preserves email and URL case, and uploads the cropped optional photo to the existing public `avatar` bucket. Set `SUPABASE_PHOTO_BUCKET` if you use a different public bucket.

The form starts with an Employee Code check. `get_employee_form_by_code.sql` loads only form fields and the current Account/LOB assignment. A matching code opens the saved profile; an absent code opens a blank profile. This is a code-only lookup, as requested, and does not verify employee identity. Use the form within your existing internal access controls.

`save_employee_information.sql` creates new profiles or updates the specific profile returned by lookup. Both the employee details and assignment are saved in one transaction. A signed, expiring lookup token binds updates to the checked record. Duplicate codes or Company Gmail addresses belonging to another record are rejected. Login roles, passwords, and employment statuses remain unchanged.

Unedited saved addresses and existing photos are preserved. Editing the address fields replaces the stored address with their combined value. Changing Account/LOB closes the current assignment and adds a new one, preserving assignment history.

Both functions are restricted to `service_role` and use `SECURITY INVOKER`. They have been installed on CTNP System (`zhdmsmwrskxowvytedgh`). For a different project with the same schema, install both SQL files using the Supabase SQL editor before using the form.

A confirmed database rejection removes a newly uploaded photo. An uncertain network failure retains it because the database transaction may already have committed. The UI keeps the entered information on errors and disables repeated submissions while saving or after success.
