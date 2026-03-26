"""
Migration to setup periodic tasks for TV Panel automation.
Uses django_celery_beat.
"""
from django.db import migrations


def setup_periodic_tasks(apps, schema_editor):
    try:
        PeriodicTask = apps.get_model('django_celery_beat', 'PeriodicTask')
        IntervalSchedule = apps.get_model('django_celery_beat', 'IntervalSchedule')
    except LookupError:
        return

    # 1. Schedule for triggering calls (every 1 minute)
    schedule_min, _ = IntervalSchedule.objects.get_or_create(
        every=1,
        period='minutes', # Em model instances, o campo period é lower case string
    )

    PeriodicTask.objects.update_or_create(
        name="TV: Check and Trigger Automatic Calls",
        task="tv.tasks.check_and_trigger_tv_calls",
        defaults={
            "interval": schedule_min,
            "queue": "tv",
        }
    )

    # 2. Schedule for high-priority resending (every 30 seconds)
    schedule_30s, _ = IntervalSchedule.objects.get_or_create(
        every=30,
        period='seconds', # Em model instances, o campo period é lower case string
    )

    PeriodicTask.objects.update_or_create(
        name="TV: Resend High Priority Calls",
        task="tv.tasks.resend_high_priority_calls",
        defaults={
            "interval": schedule_30s,
            "queue": "tv",
        }
    )


def remove_periodic_tasks(apps, schema_editor):
    try:
        PeriodicTask = apps.get_model('django_celery_beat', 'PeriodicTask')
        PeriodicTask.objects.filter(task__startswith="tv.tasks.").delete()
    except LookupError:
        pass


class Migration(migrations.Migration):

    dependencies = [
        ('tv', '0001_initial'),
        ('django_celery_beat', '0001_initial'), # Garante que as tabelas de tarefas existem
    ]

    operations = [
        migrations.RunPython(setup_periodic_tasks, remove_periodic_tasks),
    ]
