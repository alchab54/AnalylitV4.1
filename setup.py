# setup.py
from setuptools import setup, find_packages

setup(
    name='analylit',
    version='4.2.0',
    packages=find_packages(),
    include_package_data=True,
    zip_safe=False,
    install_requires=[
        # Laissez vide, car les dépendances sont gérées par requirements.txt
    ],
)
