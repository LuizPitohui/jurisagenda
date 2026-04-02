"""
Migration para registrar tasks de e-mail no Celery Beat.
"""
from django.db import migrations


def setup_email_tasks(apps, schema_editor):
    try:
        PeriodicTask    = apps.get_model('django_celery_beat', 'PeriodicTask')
        CrontabSchedule = apps.get_model('django_celery_beat', 'CrontabSchedule')
    except LookupError:
        return

    # Roda todo dia às 08:00 (horário do servidor — America/Manaus)
    morning, _ = CrontabSchedule.objects.get_or_create(
        minute='0', hour='8', day_of_week='*',
        day_of_month='*', month_of_year='*',
    )

    PeriodicTask.objects.update_or_create(
        name="Email: Lembretes de eventos do dia seguinte",
        task="events.tasks.send_upcoming_event_reminders",
        defaults={"crontab": morning, "queue": "default"},
    )

    PeriodicTask.objects.update_or_create(
        name="Email: Alertas de prazos vencendo",
        task="events.tasks.send_deadline_alerts",
        defaults={"crontab": morning, "queue": "default"},
    )


def remove_email_tasks(apps, schema_editor):
    try:
        PeriodicTask = apps.get_model('django_celery_beat', 'PeriodicTask')
        PeriodicTask.objects.filter(
            task__in=[
                "events.tasks.send_upcoming_event_reminders",
                "events.tasks.send_deadline_alerts",
            ]
        ).delete()
    except LookupError:
        pass


class Migration(migrations.Migration):

    dependencies = [
        ('events', '0002_event_tv_advance_unit_event_tv_advance_value_and_more'),
        ('django_celery_beat', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(setup_email_tasks, remove_email_tasks),
    ]
