export async function checkMock(detection) {
  return {
    ok: true,
    checkedIn: Boolean(detection.mockCheckedIn),
    checkedAt: new Date().toISOString(),
  };
}
