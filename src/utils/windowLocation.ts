export const reloadPage = (locationRef: Pick<Location, 'reload'> = window.location) => {
  locationRef.reload()
}
