$path = "app.js"
$content = Get-Content $path -Raw -Encoding UTF8

# Фикс 1: Copy/Push кнопки карточек — показывают реальный текст в тосте
$old1 = "_mCopy(b.dataset.text, 'Copy')"
$new1 = "_mCopy(b.dataset.text, b.dataset.text)"
$content = $content.Replace($old1, $new1)

$old2 = "_mCopy(b.dataset.text, 'Push')"
$new2 = "_mCopy(b.dataset.text, b.dataset.text)"
$content = $content.Replace($old2, $new2)

Set-Content $path $content -Encoding UTF8 -NoNewline
Write-Host "Done"
