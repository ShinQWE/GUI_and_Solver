# medical_assistant/cli.py - ИСПРАВЛЕННАЯ ВЕРСИЯ
#!/usr/bin/env python3
import argparse
import sys
import os
import shutil
import glob

# Добавьте путь к текущей директории в Python path
sys.path.insert(0, os.path.dirname(__file__))

from core import MedicalAssistant


def copy_json_to_data_dir(json_filepath, data_dir='ИБ'):
    """
    Копирует JSON файл пациента в папку данных, предварительно очищая её
    """
    # Создаем папку если её нет
    os.makedirs(data_dir, exist_ok=True)

    # Очищаем папку от старых JSON файлов
    old_json_files = glob.glob(f'{data_dir}/*.json')
    for old_file in old_json_files:
        os.remove(old_file)
        print(f"[УДАЛЕНО] Старый файл: {os.path.basename(old_file)}")

    # Копируем новый файл
    filename = os.path.basename(json_filepath)
    destination = os.path.join(data_dir, filename)
    shutil.copy2(json_filepath, destination)
    print(f"[OK] Файл скопирован: {filename} -> {data_dir}/")

    return destination


def main():
    parser = argparse.ArgumentParser(description='Медицинский ассистент для рекомендаций по лечению')
    parser.add_argument('--model', default='mistral', help='Модель Ollama для использования')
    parser.add_argument('--data-dir', default='ИБ', help='Путь к папке с данными пациента')
    parser.add_argument('--json-file', help='Путь к JSON файлу пациента (будет скопирован в папку данных)')
    parser.add_argument('--interactive', action='store_true', help='Интерактивный режим')

    args = parser.parse_args()

    try:
        # Если указан JSON файл, копируем его в папку данных
        if args.json_file:
            if not os.path.exists(args.json_file):
                print(f"[ОШИБКА] Файл не найден: {args.json_file}")
                sys.exit(1)

            print(f"[ЗАГРУЗКА] Файл пациента: {os.path.basename(args.json_file)}")
            copy_json_to_data_dir(args.json_file, args.data_dir)

        print("[ИНИЦИАЛИЗАЦИЯ] Медицинского ассистента...")
        assistant = MedicalAssistant(model=args.model)
        assistant.initialize_system(data_path=args.data_dir)

        print("[АНАЛИЗ] Получение рекомендации по лечению...")

        # Используем прямое обращение к ollama_chat вместо get_treatment_recommendation
        system_message = assistant.get_system_message_by_diagnosis(assistant.patient_data)
        clinical_diagnosis = assistant.patient_data.get("Клинический диагноз", {}).get("Значение", "не указан")
        user_input = f"Назначьте лечение для пациента с диагнозом: {clinical_diagnosis}"

        recommendation = assistant.ollama_chat(
            user_input,
            system_message,
            assistant.vault_embeddings_tensor,
            assistant.vault_content,
            assistant.model,
            assistant.conversation_history,
            assistant.patient_data
        )

        print("\n" + "=" * 60)
        print("РЕКОМЕНДАЦИЯ ПО ЛЕЧЕНИЮ")
        print("=" * 60)
        print(recommendation)
        print("=" * 60)

        if args.interactive:
            print("\n[ИНТЕРАКТИВ] Вход в интерактивный режим...")
            # Создаем простой интерактивный цикл
            system_message = assistant.get_system_message_by_diagnosis(assistant.patient_data)
            print("\n[ИНТЕРАКТИВ] Режим (введите 'exit' для выхода)")

            while True:
                try:
                    user_input = input("\n[ВОПРОС] Ваш вопрос: ").strip()

                    if user_input.lower() in ['exit', 'quit', 'выход']:
                        break

                    if not user_input:
                        continue

                    response = assistant.ollama_chat(
                        user_input,
                        system_message,
                        assistant.vault_embeddings_tensor,
                        assistant.vault_content,
                        assistant.model,
                        assistant.conversation_history,
                        assistant.patient_data
                    )

                    print(f"\n[ОТВЕТ] {response}")

                except KeyboardInterrupt:
                    print("\n\n[ВЫХОД] Из интерактивного режима.")
                    break
                except Exception as e:
                    print(f"\n[ОШИБКА] {e}")

    except Exception as e:
        print(f"[ОШИБКА] {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()