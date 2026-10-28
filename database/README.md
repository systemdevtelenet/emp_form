# Employee submission setup

Copy `.env.example` to `.env.local`, set `SUPABASE_SECRET_KEY` to the CTNP System server secret key, and restart the development server. A legacy service-role key may instead be supplied as `SUPABASE_SERVICE_ROLE_KEY`. These values are used only on the server; no frontend key is needed.

Submit sends the form to `POST /api/employees`. The server validates all required fields, generates the employee name, combines address parts, preserves email and URL case, and uploads the cropped optional photo to the existing public `avatar` bucket. Set `SUPABASE_PHOTO_BUCKET` if you use a different public bucket.

Step 02 keeps `employees.contact_number` as the required primary number. Employees can add up to five optional extra numbers without assigning a type. `add_employee_phone_numbers.sql` creates `employee_phone_numbers` and the `save_employee_information_with_phones` RPC. The existing table's internal `label` field defaults to `OTHER` for new numbers; it is not shown in the form or preview. Additional numbers are saved with the profile and account assignments in one transaction, and lookup reloads them for editing. Install this SQL after `save_employee_information.sql` on other projects.

Step 01 includes a required Tax Status Code dropdown. Existing profiles must select a status before saving changes. The accepted values are SINGLE, MARRIED, WIDOWED, LEGALLY SEPARATED, DIVORCED, and ANNULLED. The database/add_tax_status_code.sql script adds the employee column and requires one of these values for new or updated records. Existing records remain unchanged until they are saved.

The form starts with an Employee Code check. `get_employee_form_by_code.sql` loads only form fields and all current Account/LOB assignments. A matching code opens the saved profile; an absent code opens a blank profile. This is a code-only lookup, as requested, and does not verify employee identity. Use the form within your existing internal access controls.

`save_employee_information.sql` creates new profiles or updates the specific profile returned by lookup. The grouped account/LOB choices, including multiple accounts and multiple LOBs within an account, are saved with the employee details in one transaction. Each selected account must have at least one LOB; leaving the optional section blank removes current assignments when updating. A signed, expiring lookup token binds updates to the checked record. Duplicate codes or Company Gmail addresses belonging to another record are rejected. Login roles and passwords remain unchanged. Employment status is selected from the configured status list.

Step 01 displays Employee Code as read-only after lookup. The server also requires the submitted code to match the signed lookup token, so profile editing cannot change it. `allow_employee_code_correction.sql` documents the temporary correction function used earlier; the form no longer calls it.

Step 03 includes a required employment-status dropdown. Department, shift type, and shift are optional; entered shifts must match the displayed time format. The years-of-service display is calculated from the hire date and current local time; it is not stored separately.

Run `add_position_other.sql` before the form RPC scripts to add the approved position choices and the nullable `employees.position_other` field. Choosing Other in Step 03 requires a typed title; the shared `position_id` points to Other and the typed title is saved separately. Choosing a listed position clears any previous typed title. Technician is a Position choice, while L1, L2, and L3 are Level choices. Special Operations Agent remains available as a Position choice.

Unedited saved addresses and existing photos are preserved. Editing address fields replaces that address with their combined value. The present-address checkbox stores the home address as the present address when selected. Emergency contact fields are optional. Each selected account requires an account type and at least one LOB. Changing the account/LOB selection closes current assignments and adds the selected pairs, preserving assignment history.

The optional `emergency_contact_additional_number` is stored on `employees` beside the primary emergency contact number; employee-owned extra numbers remain in `employee_phone_numbers`. Install `add_emergency_contact_additional_number.sql` after `add_employee_phone_numbers.sql` to add the column and extend the atomic save wrapper. `add_requested_accounts.sql` adds SALES, ADMIN, NETSTAR, INFORMATION TECHNOLOGY, MANAGEMENT, COSMETICS, TELENET KIDS, TRANSPO3/RESERVATIONS, MARKETING, and HUMAN RESOURCES once, each with a MAIN LOB required by the current form.

`add_voice_inbound_account_type.sql` adds VOICE - INBOUND to the Type of account choices accepted by the database. It keeps the existing choices and updates the account-assignment save function.

The form RPC functions are restricted to `service_role` and use `SECURITY INVOKER`. They have been installed on CTNP System (`zhdmsmwrskxowvytedgh`). For a different project with the same schema, install add_tax_status_code.sql, add_employee_contact_details.sql, add_position_other.sql, get_employee_form_by_code.sql, save_employee_information.sql, add_employee_phone_numbers.sql, add_emergency_contact_additional_number.sql, add_requested_accounts.sql, and add_voice_inbound_account_type.sql in that order before using the form.

A confirmed database rejection removes a newly uploaded photo. An uncertain network failure retains it because the database transaction may already have committed. The UI keeps the entered information on errors and disables repeated submissions while saving or after success.
