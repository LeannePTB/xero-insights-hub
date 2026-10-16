/**
 * Business Health visibility is decided in the database:
 * `me_can_see_business_health(client)` (practice and Viewers always; Business
 * Owners only once a System Administrator releases it via
 * `admin_set_business_health_release`). Never an access grant — entitlement
 * stays `client_can_use_widget('health')`.
 */
export {};
