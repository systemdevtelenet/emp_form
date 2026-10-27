# Employee submission setup

Copy `.env.example` to `.env.local`, set `SUPABASE_SECRET_KEY` to the CTNP System server secret key, and restart the development server. A legacy service-role key may instead be supplied as `SUPABASE_SERVICE_ROLE_KEY`. These values are used only on the server; no frontend key is needed.

Submit sends the form to `POST /api/employees`. The server validates all required fields, generates the employee name, combines address parts, preserves email and URL case, and uploads the cropped optional photo to the existing public `avatar` bucket. Set `SUPABASE_PHOTO_BUCKET` if you use a different public bucket.

Step 01 includes a required Tax Status Code dropdown. Existing profiles must select a status before saving changes. The accepted values are SINGLE, MARRIED, WIDOWED, LEGALLY SEPARATED, DIVORCED, and ANNULLED. The database/add_tax_status_code.sql script adds the employee column and requires one of these values for new or updated records. Existing records remain unchanged until they are saved.

The form starts with an Employee Code check. `get_employee_form_by_code.sql` loads only form fields and all current Account/LOB assignments. A matching code opens the saved profile; an absent code opens a blank profile. This is a code-only lookup, as requested, and does not verify employee identity. Use the form within your existing internal access controls.

`save_employee_information.sql` creates new profiles or updates the specific profile returned by lookup. The grouped account/LOB choices, including multiple accounts and multiple LOBs within an account, are saved with the employee details in one transaction. Each selected account must have at least one LOB; leaving the optional section blank removes current assignments when updating. A signed, expiring lookup token binds updates to the checked record. Duplicate codes or Company Gmail addresses belonging to another record are rejected. Login roles and passwords remain unchanged. Employment status is selected from the configured status list.

Step 03 includes a required employment-status dropdown. The years-of-service display is calculated from the hire date and current local date; it is not stored separately.

Unedited saved addresses and existing photos are preserved. Editing address fields replaces that address with their combined value. The present-address checkbox stores the home address as the present address when selected. Emergency contact fields are optional. Each selected account requires an account type and at least one LOB. Changing the account/LOB selection closes current assignments and adds the selected pairs, preserving assignment history.

The form RPC functions are restricted to `service_role` and use `SECURITY INVOKER`. They have been installed on CTNP System (`zhdmsmwrskxowvytedgh`). For a different project with the same schema, install add_tax_status_code.sql, add_employee_contact_details.sql, get_employee_form_by_code.sql, and save_employee_information.sql using the Supabase SQL editor before using the form.

A confirmed database rejection removes a newly uploaded photo. An uncertain network failure retains it because the database transaction may already have committed. The UI keeps the entered information on errors and disables repeated submissions while saving or after success.
