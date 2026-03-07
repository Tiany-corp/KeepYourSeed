@echo off
echo ===================================================
echo   Lancement de KeepYourSeed (Local, Build, et Prod)
echo ===================================================

echo Ouverture des pages dans le navigateur 
start http://localhost:8081
start http://localhost:3000/kys-web-app/

echo Ouverture de Windows Terminal avec 3 onglets...
:: -d . => Ouvre dans le dossier courant
:: L'option 'new-tab' permet d'ouvrir un nouvel onglet dans la même fenêtre Windows Terminal
wt -p "Command Prompt" -d . cmd /k "title Version Locale && echo Lancement version locale... && npm start" ; new-tab -p "Command Prompt" -d . cmd /k "title Build Web && echo Build de la version web... && npm run build:web && echo === Build web termine ===" ; new-tab -p "Command Prompt" -d . cmd /k "title Version Prod && echo Lancement version prod (attendez la fin du build)... && timeout /t 15 && npm run test:prod"
