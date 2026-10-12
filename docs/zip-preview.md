# Looking inside a zip submission

When an assignment takes a ZIP file, the portal can open the archive and show what is in it.
Nobody has to download and unpack it to read a file.

## For faculty

- On the grading page the archive opens by itself: the folders and files on the left, the
  chosen file on the right.
- **Preview** on the assignment page opens the same viewer in a dialog.
- Click a file to read it. The arrow keys move through the files.
- The download button above the file list gives the original archive.

## For students

**Preview** on a submitted ZIP assignment opens the same viewer, so a student can check what
they handed in. A student can open only their own submission. Asking for anyone else's is
refused.

## What can be shown

| In the archive | What the viewer shows |
|---|---|
| A text file | Its text. |
| An image (PNG, JPG, JPEG, GIF, WEBP) | The image. |
| Anything else | The name and size, with "No preview for this file". |

- `.zip`, `.tar.gz` and `.tgz` archives are read.
- A file larger than 512 KB is listed but not shown. So is any file once 8 MB of previews
  have been read from one archive.
- An archive with more than 1,000 entries, or more than 200 MB unpacked, is not opened. The
  viewer says so and offers the download.
- An archive that cannot be read gets the same message and the download.
- The `__MACOSX` folder a Mac adds is left out.

## How it works

`get_submission_archive` in `cs17_portal/submission_archive.py` reads the file attached to
the submission and returns the list of entries with their previews. It answers a faculty of
the assignment's cohort and the student who made the submission. Nothing is unpacked to
disk. The dashboard side is `components/grading/ArchiveViewer.vue`, used by
`components/grading/SubmissionPlayer.vue` and `components/assignments/SubmissionPreviewDialog.vue`.
